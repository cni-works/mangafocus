( function() {
	'use strict';
	const i18n = window.wp && window.wp.i18n ? window.wp.i18n : {};
	const __ = typeof i18n.__ === 'function' ? i18n.__ : function( text ) { return text; };
	const sprintf = typeof i18n.sprintf === 'function' ? i18n.sprintf : function( format ) {
		const values = Array.prototype.slice.call( arguments, 1 );
		let sequentialIndex = 0;
		return format.replace( /%(?:(\d+)\$)?d/g, function( match, position ) {
			const index = position ? Number( position ) - 1 : sequentialIndex++;
			return String( values[ index ] );
		} );
	};
	const extensionApiVersion = 1;
	const publicInstances = new WeakMap();
	const publicRuntime = window.aiMangaViewer = window.aiMangaViewer || {};
	publicRuntime.extensionApiVersion = extensionApiVersion;
	publicRuntime.getInstance = function( target ) {
		if ( target && target.nodeType === 1 ) return publicInstances.get( target ) || null;
		if ( typeof target !== 'string' || ! target ) return null;
		const roots = document.querySelectorAll( '.amv-reader' );
		for ( let index = 0; index < roots.length; index++ ) if ( roots[ index ].dataset.instanceKey === target ) return publicInstances.get( roots[ index ] ) || null;
		return null;
	};
	const duration = 360;
	const layout = window.aiMangaViewerLayout;
	function clamp( value, min, max ) { return Math.max( min, Math.min( max, value ) ); }
	function bindSwipe( element, threshold, onSwipe ) {
		let start = null;
		element.addEventListener( 'touchstart', function( event ) {
			start = event.touches.length === 1 ? { id: event.touches[ 0 ].identifier, x: event.touches[ 0 ].clientX, y: event.touches[ 0 ].clientY } : null;
		}, { passive: true } );
		element.addEventListener( 'touchmove', function( event ) { if ( event.touches.length !== 1 ) start = null; }, { passive: true } );
		element.addEventListener( 'touchcancel', function() { start = null; }, { passive: true } );
		element.addEventListener( 'touchend', function( event ) {
			const origin = start; start = null;
			if ( ! origin || event.touches.length ) return;
			const end = Array.from( event.changedTouches ).find( function( touch ) { return touch.identifier === origin.id; } );
			if ( ! end ) return;
			const dx = end.clientX - origin.x, dy = end.clientY - origin.y;
			if ( Math.abs( dx ) < threshold || Math.abs( dx ) <= Math.abs( dy ) ) return;
			onSwipe( dx );
		}, { passive: true } );
	}
	function init( root ) {
		const stage = root.querySelector( '.amv-reader__stage' );
		const pages = Array.prototype.slice.call( root.querySelectorAll( '.amv-reader__page' ) );
		const focusLayer = root.querySelector( '.amv-reader__focus-layer' );
		const surface = root.querySelector( '.amv-reader__surface' );
		if ( ! stage || ! focusLayer || ! surface || ! pages.length ) return;
		const binding = root.dataset.binding === 'ltr' ? 'ltr' : 'rtl';
		const configuredLayout = [ 'spread', 'auto' ].indexOf( root.dataset.pageLayout ) !== -1 ? root.dataset.pageLayout : 'single';
		const singleFirstPage = root.dataset.singleFirstPage !== 'off';
		const spreadReadingMode = root.dataset.spreadReadingMode === 'pageFocus' ? 'pageFocus' : 'overview';
		const fullscreenReadingMode = root.dataset.fullscreenReadingMode === 'vertical' ? 'vertical' : 'paged';
		const verticalZoomMaximum = 2;
		const layoutThresholds = { auto: { enter: 780, exit: 740 }, spread: { enter: 600, exit: 560 } };
		const pageFocusViewportReserve = 128;
		const buttons = { previous: root.querySelectorAll( '.amv-reader__button--previous, .amv-reader__edge--previous' ), next: root.querySelectorAll( '.amv-reader__button--next, .amv-reader__edge--next' ) };
		const count = root.querySelector( '.amv-reader__count' );
		const zoomOut = root.querySelector( '.amv-reader__zoom-out' );
		const zoomIn = root.querySelector( '.amv-reader__zoom-in' );
		const zoomReset = root.querySelector( '.amv-reader__zoom-reset' );
		const zoomLevel = root.querySelector( '.amv-reader__zoom-level' );
		const zoomPagePrevious = root.querySelector( '.amv-reader__zoom-page--previous' );
		const zoomPageNext = root.querySelector( '.amv-reader__zoom-page--next' );
		const independentModes = root.dataset.enableInline === 'on' || root.dataset.enableInline === 'off';
		let inlineFallback = false;
		function readerVisible() { return ! independentModes || root.dataset.enableInline !== 'off' || inlineFallback || isRootFullscreen(); }
		function syncReaderVisibility() {
			if ( ! independentModes ) return;
			const visible = readerVisible();
			[ stage, root.querySelector( '.amv-reader__controls' ), root.querySelector( '.amv-reader__mode-controls' ) ].filter( Boolean ).forEach( function( part ) { part.hidden = ! visible; part.inert = ! visible; part.setAttribute( 'aria-hidden', visible ? 'false' : 'true' ); } );
		}
		function useInlineFallback() {
			if ( ! independentModes || root.dataset.enableInline !== 'off' || root.dataset.amvPanelReader === 'on' ) return;
			inlineFallback = true; root.classList.remove( 'amv-reader--cover-launcher' );
			const cover = root.querySelector( '.amv-reader__cover-launcher' ); if ( cover ) cover.hidden = true;
			syncReaderVisibility(); updatePageAccessibility(); discoverImageDimensions();
		}
		const coverLauncher = root.querySelector( '.amv-reader__cover-launcher-button' );
		const spreadOverview = root.querySelector( '.amv-reader__spread-overview' );
		const zoomEnabled = root.dataset.zoom === 'on';
		const fullscreenStartAtCurrent = root.dataset.fullscreenStart === 'current';
		let current = 0, currentView = 0, focusedPageIndex = 0, verticalCurrentPage = 0, temporaryOverview = false, views = pages.map( function( page, index ) { return [ index ]; } ), spreadActive = false, locked = false, scrollTimer = null, assisting = false, fullscreenReturnViewportTop = null, fullscreenReturnFocus = null, zoomScale = 1, panX = 0, panY = 0, panPointer = null, touchPan = null, pinch = null, verticalObserver = null, verticalVisibility = {};
		const viewerKey = root.dataset.viewerKey || '', instanceKey = root.dataset.instanceKey || '';
		let activeMode = 'standard', extensionMode = '';
		let verticalStartCleanup = null;
		let extensionReady = false, lastPublicView = '', lastPublicFullscreen = false;

		// Visual-only outgoing sheet: never clone page/extension DOM, IDs or listeners.
		let navigationEffect = null;
		let transitionContent = null;
		const reducedMotion = window.matchMedia( '(prefers-reduced-motion: reduce)' );
		function cancelNavigationAnimation( commit ) {
			if ( navigationEffect ) navigationEffect.finish( commit !== false );
		}
		function transitionKind() {
			const value = root.dataset.pageTransition;
			return [ 'none', 'turn', 'fade', 'slide' ].indexOf( value ) !== -1 ? value : ( root.dataset.animation === 'off' ? 'none' : 'turn' );
		}
		function warmAdjacentViews() {
			// Keep this bounded to neighboring views, and do not change legacy loading behavior.
			if ( [ 'turn', 'fade', 'slide' ].indexOf( root.dataset.pageTransition ) === -1 || ! readerVisible() || isVerticalReading() || extensionMode === 'panel' || usesPageFocusNavigation() || ( isRootFullscreen() && fullscreenReadingMode === 'vertical' ) ) return;
			[ currentView - 1, currentView + 1 ].forEach( function( index ) {
				( views[ index ] || [] ).forEach( function( pageIndex ) {
					const image = pages[ pageIndex ].querySelector( '.amv-reader__image' );
					if ( image ) image.loading = 'eager';
				} );
			} );
		}
		function transitionImagesReady( indexes ) {
			return indexes.every( function( index ) {
				const image = pages[ index ] && pages[ index ].querySelector( '.amv-reader__image' );
				return image && image.complete && image.naturalWidth > 0;
			} );
		}
		function animateViewChange( nextView, effect, direction ) {
			const viewport = root.querySelector( '.amv-reader__pages' );
			if ( ! viewport || typeof viewport.animate !== 'function' || ! transitionImagesReady( activePageIndexes() ) || ! transitionImagesReady( views[ nextView ] ) ) return false;
			const rect = viewport.getBoundingClientRect();
			if ( ! rect.width || ! rect.height ) return false;
			const sheet = document.createElement( 'div' );
			sheet.className = 'amv-reader__transition-sheet';
			sheet.setAttribute( 'aria-hidden', 'true' ); sheet.inert = true;
			const imageBoxes = [];
			activePageIndexes().forEach( function( index ) {
				const original = pages[ index ].querySelector( '.amv-reader__image' ), image = document.createElement( 'img' ), box = original.getBoundingClientRect();
				image.className = 'amv-reader__transition-image'; image.alt = ''; image.draggable = false;
				image.src = original.currentSrc || original.src;
				image.style.backgroundColor = window.getComputedStyle( pages[ index ] ).backgroundColor;
				image.style.left = ( box.left - rect.left - viewport.clientLeft ) + 'px';
				image.style.top = ( box.top - rect.top - viewport.clientTop ) + 'px';
				image.style.width = box.width + 'px'; image.style.height = box.height + 'px';
				sheet.appendChild( image ); imageBoxes.push( { image: image, box: box } );
			} );
			if ( ! transitionContent ) {
				transitionContent = document.createElement( 'div' ); transitionContent.className = 'amv-reader__transition-content';
				focusLayer.parentNode.insertBefore( transitionContent, focusLayer ); transitionContent.appendChild( focusLayer );
			}
			const contentWidth = focusLayer.style.width, contentMargin = focusLayer.style.marginInline, minimum = viewport.style.minHeight, pointerEvents = transitionContent.style.pointerEvents, busy = root.getAttribute( 'aria-busy' ), previousWidth = root.style.getPropertyValue( '--amv-transition-width' );
			const milliseconds = effect === 'turn' ? duration : ( effect === 'slide' ? 600 : 380 );
			const sign = ( binding === 'rtl' ? 1 : -1 ) * ( direction === 'next' ? 1 : -1 );
			let settled = false, timer = 0, animations = [];
			const state = { width: viewport.clientWidth, finish: function() {
				if ( settled ) return; settled = true; navigationEffect = null;
				window.clearTimeout( timer ); animations.forEach( function( animation ) { animation.cancel(); } );
				sheet.remove(); viewport.style.minHeight = minimum; focusLayer.style.width = contentWidth; focusLayer.style.marginInline = contentMargin; transitionContent.style.pointerEvents = pointerEvents;
				root.classList.remove( 'is-view-transitioning' );
				if ( previousWidth ) root.style.setProperty( '--amv-transition-width', previousWidth ); else root.style.removeProperty( '--amv-transition-width' );
				if ( busy === null ) root.removeAttribute( 'aria-busy' ); else root.setAttribute( 'aria-busy', busy );
				locked = false; updateButtons();
				window.requestAnimationFrame( function() { updateFullscreenSpreadSizing(); applyPageFocus(); updateInlineNavigation(); } );
			} };
			locked = true; root.setAttribute( 'aria-busy', 'true' );
			transitionContent.style.pointerEvents = 'none';
			activateView( nextView );
			// Resolve the target's normal layout before pinning any animation frame.
			updateFullscreenSpreadSizing(); applyPageFocus(); updateInlineNavigation();
			const targetWidth = focusLayer.getBoundingClientRect().width;
			const frameWidth = Math.max( rect.width, viewport.getBoundingClientRect().width );
			focusLayer.style.width = targetWidth + 'px'; focusLayer.style.marginInline = 'auto';
			navigationEffect = state; state.pinnedLayout = true;
			viewport.appendChild( sheet );
			root.style.setProperty( '--amv-transition-width', frameWidth + 'px' ); root.classList.add( 'is-view-transitioning' );
			const frame = viewport.getBoundingClientRect();
			imageBoxes.forEach( function( item ) { item.image.style.left = ( item.box.left - frame.left - viewport.clientLeft ) + 'px'; item.image.style.top = ( item.box.top - frame.top - viewport.clientTop ) + 'px'; } );
			state.width = viewport.clientWidth; updateButtons();
			setActiveMode( isRootFullscreen() ? 'fullscreen' : 'standard', 'navigation' );
			try {
				const options = { duration: milliseconds, easing: effect === 'slide' ? 'linear' : 'ease-in-out', fill: 'both' };
				if ( effect === 'slide' ) {
					animations.push( sheet.animate( [ { transform: 'translateX(0)' }, { transform: 'translateX(' + ( sign * 100 ) + '%)' } ], options ) );
					animations.push( transitionContent.animate( [ { transform: 'translateX(' + ( -sign * 100 ) + '%)' }, { transform: 'translateX(0)' } ], options ) );
				} else if ( effect === 'fade' ) {
					animations.push( sheet.animate( [ { opacity: 1 }, { opacity: 0 } ], options ) );
					// The incoming view stays opaque: complementary blending must not flash the background.
				} else {
					sheet.style.transformOrigin = sign > 0 ? 'right center' : 'left center';
					animations.push( sheet.animate( [ { opacity: 1, transform: 'translateX(0) rotateY(0)' }, { opacity: .42, transform: 'translateX(' + ( sign * 10 ) + '%) rotateY(' + ( -sign * 72 ) + 'deg)' } ], options ) );
				}
				animations[ animations.length - 1 ].onfinish = state.finish;
				animations.forEach( function( animation ) { animation.oncancel = state.finish; } );
				timer = window.setTimeout( state.finish, milliseconds + 80 );
			} catch ( error ) { state.finish(); }
			return true;
		}
		function handleMotionPreference() { if ( reducedMotion.matches ) cancelNavigationAnimation(); }
		if ( reducedMotion.addEventListener ) reducedMotion.addEventListener( 'change', handleMotionPreference );
		else if ( reducedMotion.addListener ) reducedMotion.addListener( handleMotionPreference );

		root.classList.add( 'is-enhanced' );
		function pageIsLandscape( index ) { const page = pages[ index ]; if ( ! page ) return false; return layout.dimensionState( { width: page.dataset.imageWidth, height: page.dataset.imageHeight } ) === 'landscape'; }
		function buildViews() {
			if ( ! spreadActive ) return pages.map( function( page, index ) { return [ index ]; } );
			return layout.buildViews( pages.length, singleFirstPage, pageIsLandscape );
		}
		function activePageIndexes() { return views[ currentView ] || [ current ]; }
		function viewForPage( pageIndex ) { const found = views.findIndex( function( view ) { return view.indexOf( pageIndex ) !== -1; } ); return found === -1 ? 0 : found; }
		function usesPageFocusNavigation() { return spreadReadingMode === 'pageFocus' && fullscreenReadingMode === 'paged' && spreadActive && isRootFullscreen(); }
		function pageFocusVisible() { return usesPageFocusNavigation() && activePageIndexes().length === 2 && ! temporaryOverview; }
		function isVerticalReading() { return root.classList.contains( 'is-vertical-reading' ); }
		function readingPageIndex() { return isVerticalReading() ? verticalCurrentPage : ( pageFocusVisible() ? focusedPageIndex : current ); }
		function reachablePageIndexes() { return pageFocusVisible() ? [ focusedPageIndex ] : activePageIndexes(); }
		function publicPage( index ) { const page = pages[ index ]; return page ? { index: index, key: page.dataset.pageKey || '' } : null; }
		function publicVisiblePages() { if ( ! readerVisible() && extensionMode !== 'panel' ) return []; return ( isVerticalReading() ? [ verticalCurrentPage ] : reachablePageIndexes() ).map( publicPage ).filter( Boolean ); }
		function publicMode() { return extensionMode || activeMode; }
		function publicIdentity() { return { viewerKey: viewerKey, instanceKey: instanceKey }; }
		function publicState() { return { identity: publicIdentity(), currentPage: publicPage( readingPageIndex() ), visiblePages: publicVisiblePages(), layout: spreadActive ? 'spread' : 'single', spreadMode: spreadReadingMode, readingMode: publicMode(), fullscreen: isRootFullscreen() }; }
		function dispatchPublicEvent( name, detail ) { if ( ! extensionReady ) return; root.dispatchEvent( new window.CustomEvent( name, { bubbles: true, detail: Object.assign( { apiVersion: extensionApiVersion, identity: publicIdentity() }, detail || {} ) } ) ); }
		function notifyViewChange( source ) { if ( ! extensionReady ) return; const state = publicState(); const signature = JSON.stringify( { currentPage: state.currentPage, visiblePages: state.visiblePages, layout: state.layout, spreadMode: state.spreadMode, readingMode: state.readingMode } ); if ( signature === lastPublicView ) return; lastPublicView = signature; dispatchPublicEvent( 'amv:viewer-viewchange', { currentPage: state.currentPage, visiblePages: state.visiblePages, layout: state.layout, spreadMode: state.spreadMode, readingMode: state.readingMode, source: source || 'reader' } ); }
		function setActiveMode( mode, source ) { const previous = publicMode(); activeMode = mode; const currentMode = publicMode(); if ( previous !== currentMode ) dispatchPublicEvent( 'amv:viewer-modechange', { readingMode: currentMode, previousMode: previous, source: source || 'reader' } ); }
		function updatePageAccessibility() {
			if ( ! readerVisible() ) { pages.forEach( function( page ) { page.setAttribute( 'aria-hidden', 'true' ); page.inert = true; } ); return; }
			if ( isVerticalReading() ) {
				pages.forEach( function( page ) { page.setAttribute( 'aria-hidden', 'false' ); page.inert = false; page.classList.remove( 'is-focused-page' ); } );
				return;
			}
			const active = activePageIndexes(); const focusedOnly = pageFocusVisible();
			pages.forEach( function( page, index ) {
				const hidden = active.indexOf( index ) === -1 || ( focusedOnly && index !== focusedPageIndex );
				page.setAttribute( 'aria-hidden', hidden ? 'true' : 'false' );
				page.inert = hidden;
				page.classList.toggle( 'is-focused-page', focusedOnly && index === focusedPageIndex );
			} );
		}
		function applyPageFocus() {
			focusLayer.style.transform = ''; focusLayer.style.transformOrigin = ''; root.querySelector( '.amv-reader__pages' ).style.height = ''; surface.style.transformOrigin = '';
			if ( isVerticalReading() ) { root.classList.remove( 'is-page-focus', 'is-temporary-overview' ); if ( spreadOverview ) spreadOverview.hidden = true; updatePageAccessibility(); return; }
			const active = activePageIndexes(); const hasFocusedSpread = usesPageFocusNavigation() && active.length === 2;
			root.classList.toggle( 'is-page-focus', hasFocusedSpread ); root.classList.toggle( 'is-temporary-overview', hasFocusedSpread && temporaryOverview );
			if ( spreadOverview ) { spreadOverview.hidden = ! hasFocusedSpread; spreadOverview.setAttribute( 'aria-pressed', temporaryOverview ? 'true' : 'false' ); spreadOverview.textContent = temporaryOverview ? __( 'Return to page view', 'mangafocus' ) : __( 'View entire spread', 'mangafocus' ); }
			updatePageAccessibility();
			if ( ! hasFocusedSpread || temporaryOverview ) return;
			const viewport = root.querySelector( '.amv-reader__pages' ); const page = pages[ focusedPageIndex ];
			if ( ! viewport || ! page ) return;
			const viewportRect = viewport.getBoundingClientRect(); const pageWidth = page.offsetWidth; const pageHeight = page.offsetHeight;
			if ( ! viewportRect.width || ! pageWidth || ! pageHeight ) return;
			const compact = compactPagedFullscreen();
			const availableHeight = compact ? compactReadingHeight() : Math.max( 1, window.innerHeight - pageFocusViewportReserve );
			const viewportWidth = compact ? viewport.clientWidth : viewportRect.width;
			const image = page.querySelector( '.amv-reader__image' );
			const naturalWidth = Number( page.dataset.imageWidth ) || Number( image && image.naturalWidth );
			const targetWidth = Math.min( viewportWidth, availableHeight * pageWidth / pageHeight, compact && naturalWidth > 0 ? naturalWidth : Infinity );
			const fitScale = targetWidth / pageWidth; const targetHeight = pageHeight * fitScale;
			const pageX = surface.offsetLeft + page.offsetLeft; const pageY = surface.offsetTop + page.offsetTop;
			const translateX = ( viewportWidth - targetWidth ) / 2 - pageX * fitScale; const translateY = -pageY * fitScale;
			viewport.style.height = ( targetHeight + ( compact ? viewport.offsetHeight - viewport.clientHeight : 0 ) ) + 'px'; focusLayer.style.transformOrigin = '0 0'; focusLayer.style.transform = 'translate3d(' + translateX + 'px,' + translateY + 'px,0) scale(' + fitScale + ')';
			if ( surface.offsetWidth && surface.offsetHeight ) surface.style.transformOrigin = ( ( page.offsetLeft + pageWidth / 2 ) / surface.offsetWidth * 100 ) + '% ' + ( ( page.offsetTop + pageHeight / 2 ) / surface.offsetHeight * 100 ) + '%';
		}
		function activateView( viewIndex, preferredPage ) {
			currentView = clamp( viewIndex, 0, Math.max( 0, views.length - 1 ) );
			const active = activePageIndexes(); focusedPageIndex = active.indexOf( preferredPage ) !== -1 ? preferredPage : active[ 0 ] || 0; current = focusedPageIndex;
			pages.forEach( function( page, index ) { page.classList.toggle( 'is-active', active.indexOf( index ) !== -1 ); page.classList.remove( 'is-under', 'is-leaving', 'is-leaving-next', 'is-leaving-previous', 'is-spread-first', 'is-spread-second' ); } );
			if ( active.length === 2 ) { pages[ active[ 0 ] ].classList.add( 'is-spread-first' ); pages[ active[ 1 ] ].classList.add( 'is-spread-second' ); }
			root.classList.toggle( 'is-spread-view', active.length === 2 );
			window.requestAnimationFrame( function() { updateFullscreenSpreadSizing(); applyPageFocus(); updateInlineNavigation(); } );
			warmAdjacentViews();
			notifyViewChange( 'navigation' );
		}
		// Compact paged fullscreen uses the measured stage, not a fixed toolbar reserve.
		function compactPagedFullscreen() { return isRootFullscreen() && ! isVerticalReading() && window.matchMedia( '(max-width: 781px), (max-width: 1024px) and (max-height: 600px)' ).matches; }
		function compactReadingHeight() { return parseFloat( root.style.getPropertyValue( '--amv-reader-compact-height' ) ) || 1; }
		function updateCompactFullscreenLayout() {
			const compact = compactPagedFullscreen(), wasCompact = root.classList.contains( 'has-compact-fullscreen-layout' );
			root.classList.toggle( 'has-compact-fullscreen-layout', compact );
			if ( ! compact ) {
				if ( ! wasCompact ) return;
				root.classList.remove( 'has-compact-fullscreen-cue' );
				[ '--amv-reader-compact-height', '--amv-reader-compact-width' ].forEach( function( key ) { root.style.removeProperty( key ); } );
				pages.forEach( function( page ) { page.style.removeProperty( '--amv-reader-compact-page-width' ); } );
				return;
			}
			const viewport = root.querySelector( '.amv-reader__pages' ); if ( ! viewport ) return;
			const first = usesPageFocusNavigation() ? focusedPageIndex === 0 : currentView === 0;
			const cue = root.dataset.edgeClick === 'on' && ( root.dataset.guideArrow === 'all' || first );
			root.classList.toggle( 'has-compact-fullscreen-cue', cue );
			const stageStyle = window.getComputedStyle( stage ), viewportStyle = window.getComputedStyle( viewport );
			const borderX = ( parseFloat( viewportStyle.borderLeftWidth ) || 0 ) + ( parseFloat( viewportStyle.borderRightWidth ) || 0 );
			const borderY = ( parseFloat( viewportStyle.borderTopWidth ) || 0 ) + ( parseFloat( viewportStyle.borderBottomWidth ) || 0 );
			const guideHeight = cue ? Math.max.apply( null, Array.prototype.map.call( stage.querySelectorAll( '.amv-reader__edge' ), function( button ) { return button.offsetHeight; } ).concat( [ 0 ] ) ) : 0;
			const height = Math.max( 1, stage.clientHeight - ( parseFloat( stageStyle.paddingTop ) || 0 ) - ( parseFloat( stageStyle.paddingBottom ) || 0 ) - guideHeight - ( cue ? parseFloat( stageStyle.rowGap ) || 0 : 0 ) - borderY );
			const width = Math.max( 1, stage.clientWidth - ( parseFloat( stageStyle.paddingLeft ) || 0 ) - ( parseFloat( stageStyle.paddingRight ) || 0 ) - borderX );
			const active = activePageIndexes(), spread = active.length === 2;
			const gap = spread ? parseFloat( window.getComputedStyle( root ).getPropertyValue( '--amv-reader-spread-gap' ) ) || 12 : 0;
			const maximum = parseFloat( window.getComputedStyle( root ).getPropertyValue( '--amv-reader-max-width' ) ) || width;
			const pageWidth = Math.max( 1, ( width - gap ) / active.length );
			root.style.setProperty( '--amv-reader-compact-height', height + 'px' );
			Array.prototype.forEach.call( root.querySelectorAll( '.amv-reader__page.is-active, .amv-reader__page.is-leaving' ), function( page ) {
				const image = page.querySelector( '.amv-reader__image' );
				const naturalWidth = Number( page.dataset.imageWidth ) || Number( image && image.naturalWidth );
				const naturalHeight = Number( page.dataset.imageHeight ) || Number( image && image.naturalHeight );
				const fitted = Math.min( pageWidth, maximum, naturalWidth > 0 ? naturalWidth : pageWidth, naturalWidth > 0 && naturalHeight > 0 ? height * naturalWidth / naturalHeight : pageWidth );
				page.style.setProperty( '--amv-reader-compact-page-width', Math.max( 1, fitted ) + 'px' );
			} );
			const total = active.reduce( function( sum, index ) { return sum + parseFloat( pages[ index ].style.getPropertyValue( '--amv-reader-compact-page-width' ) ); }, gap );
			root.style.setProperty( '--amv-reader-compact-width', Math.min( width, total ) + borderX + 'px' );
		}
		function updateFullscreenSpreadSizing() {
			if ( navigationEffect && navigationEffect.pinnedLayout ) return;
			updateCompactFullscreenLayout();
			pages.forEach( function( page ) { page.style.removeProperty( '--amv-reader-fullscreen-page-width' ); } );
			if ( ! isRootFullscreen() || isVerticalReading() || compactPagedFullscreen() || ! root.classList.contains( 'is-spread-view' ) ) return;
			const viewport = root.querySelector( '.amv-reader__pages' );
			const active = activePageIndexes();
			if ( ! viewport || active.length !== 2 ) return;
			const gap = parseFloat( window.getComputedStyle( root ).getPropertyValue( '--amv-reader-spread-gap' ) ) || 12;
			const maxPageWidth = Math.max( 1, viewport.clientWidth - gap ) / 2;
			const maxImageHeight = Math.max( 1, window.innerHeight - 128 );
			active.forEach( function( index ) {
				const page = pages[ index ];
				const image = page ? page.querySelector( '.amv-reader__image' ) : null;
				const width = Number( page && page.dataset.imageWidth ) || Number( image && image.naturalWidth );
				const height = Number( page && page.dataset.imageHeight ) || Number( image && image.naturalHeight );
				const aspectWidth = width > 0 && height > 0 ? maxImageHeight * width / height : maxPageWidth;
				const renderedWidth = Math.max( 1, Math.min( maxPageWidth, aspectWidth, width > 0 ? width : maxPageWidth ) );
				page.style.setProperty( '--amv-reader-fullscreen-page-width', renderedWidth + 'px' );
			} );
		}
		function rebuildViews( preservePage ) { cancelNavigationAnimation(); const target = clamp( preservePage, 0, pages.length - 1 ); views = buildViews(); temporaryOverview = false; activateView( viewForPage( target ), target ); updateButtons(); applyZoom(); }
		function updateLayoutForWidth( width ) {
			if ( configuredLayout === 'single' ) { if ( spreadActive ) { spreadActive = false; root.classList.remove( 'has-spread-layout' ); rebuildViews( current ); } return; }
			const threshold = layoutThresholds[ configuredLayout ]; const nextSpread = spreadActive ? width >= threshold.exit : width >= threshold.enter;
			if ( nextSpread === spreadActive ) return;
			const preservePage = focusedPageIndex; resetZoom(); spreadActive = nextSpread; root.classList.toggle( 'has-spread-layout', spreadActive ); rebuildViews( preservePage );
		}
		function discoverImageDimensions() {
			if ( ! readerVisible() ) return;
			pages.forEach( function( page ) {
				if ( Number( page.dataset.imageWidth ) > 0 && Number( page.dataset.imageHeight ) > 0 ) return;
				const source = page.querySelector( 'img' );
				function remember( image ) { if ( ! image || ! image.naturalWidth || ! image.naturalHeight ) return; const wasLandscape = pageIsLandscape( Number( page.dataset.pageIndex ) ); page.dataset.imageWidth = String( image.naturalWidth ); page.dataset.imageHeight = String( image.naturalHeight ); if ( spreadActive && wasLandscape !== pageIsLandscape( Number( page.dataset.pageIndex ) ) ) rebuildViews( focusedPageIndex ); else window.requestAnimationFrame( function() { updateFullscreenSpreadSizing(); applyPageFocus(); updateInlineNavigation(); } ); }
				if ( source && source.complete ) remember( source );
				else if ( source ) source.addEventListener( 'load', function() { remember( source ); }, { once: true } );
				const probeUrl = page.dataset.viewerSrc || ( source ? source.currentSrc || source.src : '' );
				if ( probeUrl && ( ! source || ! source.complete || ! source.naturalWidth ) ) { const probe = new Image(); probe.onload = function() { remember( probe ); }; probe.src = probeUrl; }
			} );
		}
		function useMode( mode ) {
			setActiveMode( mode, 'reader' );
			dispatchPublicEvent( 'amv:viewer-interaction', { source: 'reader-action', action: 'read', readingMode: mode, currentPage: publicPage( readingPageIndex() ), visiblePages: publicVisiblePages() } );
		}
		function stopVerticalObserver() {
			if ( verticalStartCleanup ) { const cleanup = verticalStartCleanup; verticalStartCleanup = null; cleanup(); }
			verticalVisibility = {};
			if ( verticalObserver ) { verticalObserver.disconnect(); verticalObserver = null; }
		}		function updateVerticalCurrentPage() {
			let bestIndex = verticalCurrentPage, bestVisible = -1, bestDistance = Infinity; const rootRect = root.getBoundingClientRect(); const center = rootRect.top + root.clientHeight / 2;
			Object.keys( verticalVisibility ).forEach( function( key ) { const state = verticalVisibility[ key ]; if ( ! state || state.visible <= 0 ) return; const distance = Math.abs( state.center - center ); if ( state.visible > bestVisible || ( state.visible === bestVisible && distance < bestDistance ) ) { bestIndex = Number( key ); bestVisible = state.visible; bestDistance = distance; } } );
			if ( bestIndex !== verticalCurrentPage ) { verticalCurrentPage = bestIndex; notifyViewChange( 'vertical-scroll' ); }
			updateButtons();
		}
		function startVerticalObserver() {
			stopVerticalObserver();
			if ( ! isVerticalReading() || ! isRootFullscreen() || typeof window.IntersectionObserver !== 'function' ) return;
			const observer = new window.IntersectionObserver( function( entries ) {
				if ( verticalObserver !== observer || ! isVerticalReading() || ! isRootFullscreen() ) return;
				entries.forEach( function( entry ) {
					const index = Number( entry.target.dataset.pageIndex ); const visibleHeight = entry.isIntersecting ? entry.intersectionRect.height : 0;
					verticalVisibility[ index ] = { visible: visibleHeight, center: entry.boundingClientRect.top + entry.boundingClientRect.height / 2 };
				} );
				updateVerticalCurrentPage();
			}, { root: root, threshold: [ 0, .1, .25, .5, .75, 1 ] } );
			verticalObserver = observer;
			pages.forEach( function( page ) { observer.observe( page ); } );
		}
		function isRootFullscreen() { return document.fullscreenElement === root; }
		function exitRootFullscreen() { const request = document.exitFullscreen(); if ( request && typeof request.catch === 'function' ) request.catch( function() {} ); }
		function activeCanvas() { return surface; }
		function verticalBaseWidth() {
			const configured = parseFloat( window.getComputedStyle( root ).getPropertyValue( '--amv-reader-max-width' ) ) || 650;
			const padding = window.matchMedia( '(max-width: 600px)' ).matches ? 24 : 32;
			return Math.max( 1, Math.min( configured, root.clientWidth - padding ) );
		}
		// Zoom controls are optional; their absence must not prevent layout or mode updates.
		function updateZoomControls( maximum ) {
			if ( zoomLevel ) zoomLevel.textContent = Math.round( zoomScale * 100 ) + '%';
			if ( zoomOut ) zoomOut.disabled = zoomScale <= 1;
			if ( zoomIn ) zoomIn.disabled = zoomScale >= maximum;
			if ( zoomReset ) zoomReset.disabled = zoomScale <= 1;
		}
		function applyVerticalZoom( preserveAnchor ) {
			if ( ! isVerticalReading() ) return;
			const anchor = pages[ verticalCurrentPage ]; const rootTop = root.getBoundingClientRect().top; const previousTop = anchor ? anchor.getBoundingClientRect().top - rootTop : 0;
			const width = verticalBaseWidth() * zoomScale;
			root.style.setProperty( '--amv-reader-vertical-width', width + 'px' );
			root.classList.toggle( 'is-vertical-zoomed', zoomScale > 1 );
			updateZoomControls( verticalZoomMaximum );
			window.requestAnimationFrame( function() {
				if ( preserveAnchor && anchor ) root.scrollTop += anchor.getBoundingClientRect().top - root.getBoundingClientRect().top - previousTop;
				root.scrollLeft = Math.max( 0, ( root.scrollWidth - root.clientWidth ) / 2 );
			} );
		}
		function zoomLimits() { const canvas = activeCanvas(), viewport = root.querySelector( '.amv-reader__pages' ); if ( ! canvas || ! viewport ) return { x: 0, y: 0 }; if ( pageFocusVisible() ) return { x: Math.max( 0, viewport.clientWidth * ( zoomScale - 1 ) / 2 ), y: Math.max( 0, viewport.clientHeight * ( zoomScale - 1 ) / 2 ) }; return { x: Math.max( 0, ( canvas.clientWidth * zoomScale - viewport.clientWidth ) / 2 ), y: Math.max( 0, ( canvas.clientHeight * zoomScale - viewport.clientHeight ) / 2 ) }; }
		function applyZoom() {
			if ( ! zoomEnabled ) return;
			if ( isVerticalReading() ) { applyVerticalZoom( true ); updateButtons(); return; }
			const canvas = activeCanvas(); if ( ! canvas ) return;
			const limits = zoomLimits(); panX = clamp( panX, -limits.x, limits.x ); panY = clamp( panY, -limits.y, limits.y );
			canvas.style.transform = zoomScale === 1 ? '' : 'translate(' + panX + 'px,' + panY + 'px) scale(' + zoomScale + ')';
			root.classList.toggle( 'is-zoomed', zoomScale > 1 ); updateZoomControls( 3 );
			updateButtons();
		}
		function setZoom( value ) { if ( ! zoomEnabled ) return; cancelNavigationAnimation(); const vertical = isVerticalReading(); const previousScale = zoomScale; zoomScale = clamp( Math.round( value * 100 ) / 100, 1, vertical ? verticalZoomMaximum : 3 ); if ( zoomScale === 1 ) { panX = 0; panY = 0; } applyZoom(); if ( vertical ) setActiveMode( 'vertical', 'zoom' ); else if ( previousScale <= 1 && zoomScale > 1 ) useMode( 'zoom' ); else if ( previousScale > 1 && zoomScale === 1 ) setActiveMode( isRootFullscreen() ? 'fullscreen' : 'standard', 'zoom-reset' ); }
		function resetZoom() { if ( ! zoomEnabled ) return; const vertical = isVerticalReading(); const canvas = activeCanvas(); if ( canvas ) canvas.style.transform = ''; zoomScale = 1; panX = 0; panY = 0; root.classList.remove( 'is-zoomed', 'is-vertical-zoomed', 'is-panning' ); updateZoomControls( vertical ? verticalZoomMaximum : 3 ); if ( vertical ) applyVerticalZoom( true ); updateButtons(); }
		function panBy( dx, dy ) { if ( zoomScale <= 1 ) return; panX += dx; panY += dy; applyZoom(); }
		// Reuse the edge buttons as real guide controls, separate from image-edge taps.
		function updateInlineNavigation() {
			updateCompactFullscreenLayout();
			const inline = readerVisible() && ! isRootFullscreen() && ! isVerticalReading();
			const cue = inline && root.dataset.edgeClick === 'on' && zoomScale <= 1 && ( root.dataset.guideArrow === 'all' || currentView === 0 );
			root.classList.toggle( 'has-inline-navigation', inline );
			root.classList.toggle( 'has-inline-navigation-cue', cue );
			if ( ! cue ) {
				root.classList.remove( 'is-inline-navigation-outside', 'is-inline-navigation-below' );
				const focused = document.activeElement;
				if ( ( inline || ( compactPagedFullscreen() && ! root.classList.contains( 'has-compact-fullscreen-cue' ) ) ) && focused && root.contains( focused ) && focused.classList.contains( 'amv-reader__edge' ) ) stage.focus( { preventScroll: true } );
				return;
			}
			const viewport = root.querySelector( '.amv-reader__pages' );
			if ( ! viewport ) return;
			const readerRect = root.getBoundingClientRect(), pageRect = viewport.getBoundingClientRect();
			let left = Math.max( 0, readerRect.left ), right = Math.min( document.documentElement.clientWidth || window.innerWidth, readerRect.right );
			for ( let parent = root.parentElement; parent; parent = parent.parentElement ) {
				const style = window.getComputedStyle( parent );
				if ( [ 'hidden', 'clip', 'auto', 'scroll' ].indexOf( style.overflowX ) !== -1 || /(?:^|\s)(?:paint|strict|content)(?:\s|$)/.test( style.contain || '' ) ) {
					const rect = parent.getBoundingClientRect();
					left = Math.max( left, rect.left + parent.clientLeft );
					right = Math.min( right, rect.left + parent.clientLeft + parent.clientWidth );
				}
			}
			const sideZoom = root.querySelector( '.amv-reader__zoom-controls--side' );
			const sideOccupied = sideZoom && sideZoom.getClientRects().length > 0;
			const clearance = 64 * ( readerRect.width / root.offsetWidth || 1 );
			const outside = ! sideOccupied && pageRect.width > 0 && pageRect.left - left >= clearance && right - pageRect.right >= clearance;
			root.classList.toggle( 'is-inline-navigation-outside', outside );
			root.classList.toggle( 'is-inline-navigation-below', ! outside );
		}
		function updateButtons() { if ( isVerticalReading() ) { updateInlineNavigation(); if ( count ) count.textContent = ( verticalCurrentPage + 1 ) + ' / ' + pages.length; stage.setAttribute( 'aria-label', sprintf( __( 'Near page %d. Scroll vertically to read.', 'mangafocus' ), verticalCurrentPage + 1 ) ); return; } const zoomed = zoomScale > 1; const pageNavigation = usesPageFocusNavigation(); const atEnd = pageNavigation ? focusedPageIndex === pages.length - 1 : currentView === views.length - 1; const atStart = pageNavigation ? focusedPageIndex === 0 : currentView === 0; const nextExitsFullscreen = atEnd && isRootFullscreen() && ! zoomed; const zoomNextExitsFullscreen = atEnd && isRootFullscreen() && zoomed; root.classList.toggle( 'is-first-page', atStart ); Array.prototype.forEach.call( buttons.previous, function( button ) { button.disabled = zoomed || atStart; } ); Array.prototype.forEach.call( buttons.next, function( button ) { button.disabled = zoomed || ( atEnd && ! nextExitsFullscreen ); button.setAttribute( 'aria-label', nextExitsFullscreen ? __( 'Exit fullscreen', 'mangafocus' ) : __( 'Next page', 'mangafocus' ) ); } ); if ( zoomPagePrevious ) zoomPagePrevious.disabled = atStart; if ( zoomPageNext ) { zoomPageNext.disabled = atEnd && ! zoomNextExitsFullscreen; zoomPageNext.setAttribute( 'aria-label', zoomNextExitsFullscreen ? __( 'Reset zoom and exit fullscreen', 'mangafocus' ) : __( 'Reset zoom and go to the next page', 'mangafocus' ) ); } const active = activePageIndexes(); const focusedOnly = pageFocusVisible(); if ( count ) count.textContent = focusedOnly ? ( focusedPageIndex + 1 ) + ' / ' + pages.length : ( active.length === 2 ? ( active[ 0 ] + 1 ) + '–' + ( active[ 1 ] + 1 ) + ' / ' + pages.length : ( active[ 0 ] + 1 ) + ' / ' + pages.length ); stage.setAttribute( 'aria-label', focusedOnly ? sprintf( __( 'Page %d is enlarged. Use the left and right arrow keys or swipe to navigate.', 'mangafocus' ), focusedPageIndex + 1 ) : ( active.length === 2 ? sprintf( __( 'Showing pages %1$d and %2$d. Use the left and right arrow keys or swipe to navigate.', 'mangafocus' ), active[ 0 ] + 1, active[ 1 ] + 1 ) : sprintf( __( 'Showing page %d. Use the left and right arrow keys or swipe to navigate.', 'mangafocus' ), active[ 0 ] + 1 ) ) ); updateInlineNavigation(); }
		function finalPageIsVisible() { return activePageIndexes().indexOf( pages.length - 1 ) !== -1; }
		function returnToFirstPage() { cancelNavigationAnimation( false ); const vertical = isVerticalReading(); resetZoom(); temporaryOverview = false; verticalCurrentPage = 0; activateView( viewForPage( 0 ), 0 ); if ( vertical ) root.scrollTop = 0; updateButtons(); setActiveMode( vertical ? 'vertical' : 'standard', 'return-to-start' ); }
		function finishViewChange( nextView, readingMode ) { activateView( nextView ); locked = false; updateButtons(); setActiveMode( isVerticalReading() ? 'vertical' : ( isRootFullscreen() ? 'fullscreen' : 'standard' ), 'navigation' ); }

		function change( nextView ) {
			nextView = clamp( nextView, 0, views.length - 1 );
			if ( nextView === currentView || locked || zoomScale > 1 || extensionMode === 'panel' ) return;
			const readingMode = isRootFullscreen() ? 'fullscreen' : 'standard';
			useMode( readingMode ); resetZoom();
			const effect = transitionKind(), direction = nextView > currentView ? 'next' : 'previous';
			if ( effect === 'none' || reducedMotion.matches ) { finishViewChange( nextView, readingMode ); return; }
			if ( effect === 'fade' || effect === 'slide' || ( spreadActive && root.dataset.pageTransition === 'turn' ) ) {
				if ( ! animateViewChange( nextView, effect, direction ) ) finishViewChange( nextView, readingMode );
				return;
			}
			// Legacy spread navigation stays instantaneous until an explicit effect is selected.
			if ( spreadActive ) { finishViewChange( nextView, readingMode ); return; }
			const oldPage = pages[ current ], newPage = pages[ views[ nextView ][ 0 ] ], busy = root.getAttribute( 'aria-busy' );
			let settled = false, timer = 0;
			const state = { width: root.querySelector( '.amv-reader__pages' ).clientWidth, finish: function( commit ) {
				if ( settled ) return; settled = true; navigationEffect = null; window.clearTimeout( timer );
				root.classList.remove( 'is-turning' );
				if ( busy === null ) root.removeAttribute( 'aria-busy' ); else root.setAttribute( 'aria-busy', busy );
				if ( commit !== false ) finishViewChange( nextView, readingMode );
				else { activateView( currentView ); locked = false; updateButtons(); }
			} };
			navigationEffect = state; locked = true; root.setAttribute( 'aria-busy', 'true' );
			newPage.classList.add( 'is-active', 'is-under' ); oldPage.classList.add( 'is-leaving', 'is-leaving-' + direction ); root.classList.add( 'is-turning' );
			timer = window.setTimeout( state.finish, duration );
		}
		function moveFocusedPage( offset ) { const target = clamp( focusedPageIndex + offset, 0, pages.length - 1 ); if ( target === focusedPageIndex || locked || zoomScale > 1 ) return; const readingMode = isRootFullscreen() ? 'fullscreen' : ( activeMode === 'zoom' ? 'zoom' : 'standard' ); const targetView = viewForPage( target ); useMode( readingMode ); resetZoom(); temporaryOverview = false; locked = true; if ( targetView !== currentView ) root.classList.add( 'is-focus-surface-changing' ); activateView( targetView, target ); locked = false; updateButtons(); setActiveMode( isVerticalReading() ? 'vertical' : ( isRootFullscreen() ? 'fullscreen' : 'standard' ), 'navigation' ); window.setTimeout( function() { root.classList.remove( 'is-focus-surface-changing' ); }, 220 ); }
		function previous() { if ( locked || isVerticalReading() || zoomScale > 1 ) return; if ( usesPageFocusNavigation() ) { moveFocusedPage( -1 ); return; } change( currentView - 1 ); } function next() { if ( locked || isVerticalReading() || zoomScale > 1 ) return; const atEnd = usesPageFocusNavigation() ? focusedPageIndex === pages.length - 1 : currentView === views.length - 1; if ( atEnd && isRootFullscreen() ) { exitRootFullscreen(); return; } if ( usesPageFocusNavigation() ) { moveFocusedPage( 1 ); return; } change( currentView + 1 ); }
		Array.prototype.forEach.call( buttons.previous, function( button ) { button.addEventListener( 'click', previous ); } ); Array.prototype.forEach.call( buttons.next, function( button ) { button.addEventListener( 'click', next ); } );
		stage.addEventListener( 'keydown', function( event ) {
			if ( ! readerVisible() ) return;
			if ( zoomEnabled && ( event.key === '+' || event.key === '=' ) ) { event.preventDefault(); setZoom( zoomScale + .25 ); return; }
			if ( zoomEnabled && ( event.key === '-' || event.key === '_' ) ) { event.preventDefault(); setZoom( zoomScale - .25 ); return; }
			if ( zoomEnabled && event.key === '0' ) { event.preventDefault(); resetZoom(); setActiveMode( isVerticalReading() ? 'vertical' : ( isRootFullscreen() ? 'fullscreen' : 'standard' ), 'keyboard' ); return; }
			if ( isVerticalReading() ) return;
			if ( zoomScale > 1 && [ 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown' ].indexOf( event.key ) !== -1 ) { event.preventDefault(); panBy( event.key === 'ArrowLeft' ? 40 : ( event.key === 'ArrowRight' ? -40 : 0 ), event.key === 'ArrowUp' ? 40 : ( event.key === 'ArrowDown' ? -40 : 0 ) ); return; }
			if ( event.key === 'ArrowLeft' ) { event.preventDefault(); binding === 'rtl' ? next() : previous(); } if ( event.key === 'ArrowRight' ) { event.preventDefault(); binding === 'rtl' ? previous() : next(); }
		} );
		let edgeClickSuppressedUntil = 0;
		stage.addEventListener( 'click', function( event ) {
			if ( ( isRootFullscreen() && ! compactPagedFullscreen() ) || isVerticalReading() || ! readerVisible() || root.dataset.edgeClick !== 'on' || zoomScale > 1 || event.defaultPrevented || Date.now() < edgeClickSuppressedUntil ) return;
			if ( event.target.closest && event.target.closest( '[data-amv-page-interactive], button, a, input, select, textarea, [role="button"], [contenteditable="true"]' ) ) return;
			const viewport = root.querySelector( '.amv-reader__pages' ), rect = viewport && viewport.getBoundingClientRect();
			if ( ! rect || ! rect.width || event.clientY < rect.top || event.clientY > rect.bottom || event.clientX < rect.left || event.clientX > rect.right ) return;
			const x = ( event.clientX - rect.left ) / rect.width;
			if ( x < .16 ) { binding === 'rtl' ? next() : previous(); }
			else if ( x > .84 ) { binding === 'rtl' ? previous() : next(); }
		} );
		bindSwipe( stage, 40, function( dx ) { if ( isVerticalReading() || zoomScale > 1 ) return; if ( ! isRootFullscreen() || compactPagedFullscreen() ) edgeClickSuppressedUntil = Date.now() + 500; ( binding === 'rtl' ? dx > 0 : dx < 0 ) ? next() : previous(); } );
		if ( zoomEnabled ) {
			if ( zoomOut ) zoomOut.addEventListener( 'click', function() { setZoom( zoomScale - .25 ); } );
			if ( zoomIn ) zoomIn.addEventListener( 'click', function() { setZoom( zoomScale + .25 ); } );
			if ( zoomReset ) zoomReset.addEventListener( 'click', function() { resetZoom(); setActiveMode( isVerticalReading() ? 'vertical' : ( isRootFullscreen() ? 'fullscreen' : 'standard' ), 'zoom-reset' ); } );
			if ( zoomPagePrevious ) zoomPagePrevious.addEventListener( 'click', function() { if ( zoomScale <= 1 ) return; resetZoom(); previous(); } );
			if ( zoomPageNext ) zoomPageNext.addEventListener( 'click', function() { if ( zoomScale <= 1 ) return; resetZoom(); next(); } );
			stage.addEventListener( 'pointerdown', function( event ) { if ( isVerticalReading() || zoomScale <= 1 || event.pointerType === 'touch' || event.button !== 0 || ( event.target.closest && event.target.closest( '[data-amv-page-interactive], .amv-reader__zoom-controls' ) ) ) return; event.preventDefault(); panPointer = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: panX, panY: panY }; root.classList.add( 'is-panning' ); stage.setPointerCapture && stage.setPointerCapture( event.pointerId ); } );
			stage.addEventListener( 'pointermove', function( event ) { if ( ! panPointer || panPointer.id !== event.pointerId ) return; event.preventDefault(); panX = panPointer.panX + event.clientX - panPointer.x; panY = panPointer.panY + event.clientY - panPointer.y; applyZoom(); } );
			function endPointer( event ) { if ( ! panPointer || panPointer.id !== event.pointerId ) return; panPointer = null; root.classList.remove( 'is-panning' ); if ( stage.hasPointerCapture && stage.hasPointerCapture( event.pointerId ) ) stage.releasePointerCapture( event.pointerId ); }
			stage.addEventListener( 'pointerup', endPointer ); stage.addEventListener( 'pointercancel', endPointer );
			stage.addEventListener( 'touchstart', function( event ) { if ( event.target.closest && event.target.closest( '[data-amv-page-interactive], .amv-reader__zoom-controls' ) ) return; if ( event.touches.length === 2 ) { const dx = event.touches[ 1 ].clientX - event.touches[ 0 ].clientX, dy = event.touches[ 1 ].clientY - event.touches[ 0 ].clientY; pinch = { distance: Math.hypot( dx, dy ) || 1, scale: zoomScale }; touchPan = null; event.preventDefault(); } else if ( ! isVerticalReading() && event.touches.length === 1 && zoomScale > 1 ) { touchPan = { id: event.touches[ 0 ].identifier, x: event.touches[ 0 ].clientX, y: event.touches[ 0 ].clientY, panX: panX, panY: panY }; root.classList.add( 'is-panning' ); event.preventDefault(); } }, { passive: false } );
			stage.addEventListener( 'touchmove', function( event ) { if ( pinch && event.touches.length === 2 ) { const dx = event.touches[ 1 ].clientX - event.touches[ 0 ].clientX, dy = event.touches[ 1 ].clientY - event.touches[ 0 ].clientY; setZoom( pinch.scale * Math.hypot( dx, dy ) / pinch.distance ); event.preventDefault(); return; } if ( touchPan && event.touches.length === 1 && event.touches[ 0 ].identifier === touchPan.id ) { panX = touchPan.panX + event.touches[ 0 ].clientX - touchPan.x; panY = touchPan.panY + event.touches[ 0 ].clientY - touchPan.y; applyZoom(); event.preventDefault(); } }, { passive: false } );
			function endTouch() { pinch = null; touchPan = null; root.classList.remove( 'is-panning' ); }
			stage.addEventListener( 'touchend', endTouch, { passive: true } ); stage.addEventListener( 'touchcancel', endTouch, { passive: true } );
			stage.addEventListener( 'wheel', function( event ) { if ( ! event.ctrlKey ) return; event.preventDefault(); setZoom( zoomScale + ( event.deltaY < 0 ? .25 : -.25 ) ); }, { passive: false } );
			window.addEventListener( 'resize', applyZoom ); resetZoom();
		}
		if ( root.dataset.scrollAssist === 'on' && ! window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ) window.addEventListener( 'scroll', function() { if ( ! readerVisible() || assisting ) return; window.clearTimeout( scrollTimer ); scrollTimer = window.setTimeout( function() { const rect = stage.getBoundingClientRect(), viewportHeight = window.innerHeight || document.documentElement.clientHeight, visible = Math.min( rect.bottom, viewportHeight ) - Math.max( rect.top, 0 ); if ( visible < Math.min( 160, Math.min( rect.height, viewportHeight ) * .28 ) ) return; const position = [ 'auto', 'top', 'center' ].indexOf( root.dataset.scrollPosition ) !== -1 ? root.dataset.scrollPosition : 'auto', strength = [ 'gentle', 'normal', 'strong' ].indexOf( root.dataset.scrollStrength ) !== -1 ? root.dataset.scrollStrength : 'normal', values = { gentle: { threshold: 150, amount: .45 }, normal: { threshold: 300, amount: .72 }, strong: { threshold: 520, amount: 1 } }[ strength ], centeredTarget = Math.max( 24, ( viewportHeight - rect.height ) / 2 ), target = position === 'top' ? 24 : ( position === 'center' ? centeredTarget : ( rect.height <= viewportHeight * .84 ? centeredTarget : 24 ) ), offset = rect.top - target; if ( Math.abs( offset ) < 8 || Math.abs( offset ) > values.threshold ) return; assisting = true; window.scrollTo( { top: Math.max( 0, window.scrollY + offset * values.amount ), behavior: 'smooth' } ); window.setTimeout( function() { assisting = false; }, 500 ); }, 160 ); }, { passive: true } );

		window.addEventListener( 'resize', function() { cancelNavigationAnimation(); } );
		if ( typeof window.ResizeObserver === 'function' ) new window.ResizeObserver( function() {
			const viewport = root.querySelector( '.amv-reader__pages' );
			if ( navigationEffect && viewport && Math.abs( navigationEffect.width - viewport.clientWidth ) > .5 ) cancelNavigationAnimation();
		} ).observe( root );
		[ 'load', 'error' ].forEach( function( type ) { root.addEventListener( type, function( event ) {
			if ( navigationEffect && event.target.classList && event.target.classList.contains( 'amv-reader__image' ) && activePageIndexes().some( function( index ) { return pages[ index ].contains( event.target ); } ) ) cancelNavigationAnimation();
		}, true ); } );
		syncReaderVisibility();
		activateView( 0 );
		updateLayoutForWidth( root.getBoundingClientRect().width );
		discoverImageDimensions();
		if ( typeof window.ResizeObserver === 'function' ) new window.ResizeObserver( function( entries ) { if ( entries[ 0 ] ) { updateLayoutForWidth( entries[ 0 ].contentRect.width ); window.requestAnimationFrame( function() { updateFullscreenSpreadSizing(); applyPageFocus(); updateInlineNavigation(); } ); } } ).observe( root );
		else window.addEventListener( 'resize', function() { updateLayoutForWidth( root.getBoundingClientRect().width ); window.requestAnimationFrame( function() { updateFullscreenSpreadSizing(); applyPageFocus(); updateInlineNavigation(); } ); } );
		window.addEventListener( 'resize', function() { window.requestAnimationFrame( function() { updateFullscreenSpreadSizing(); applyPageFocus(); updateInlineNavigation(); } ); } );
		if ( typeof window.ResizeObserver === 'function' ) {
			let pending = false;
			const compactObserver = new window.ResizeObserver( function() {
				if ( pending || ! compactPagedFullscreen() ) return;
				pending = true; window.requestAnimationFrame( function() { pending = false; if ( ! compactPagedFullscreen() ) return; updateFullscreenSpreadSizing(); applyPageFocus(); applyZoom(); } );
			} );
			[ stage, root.querySelector( '.amv-reader__controls' ), root.querySelector( '.amv-reader__mode-controls' ) ].filter( Boolean ).forEach( function( part ) { compactObserver.observe( part ); } );
		}

		updateButtons();
		if ( spreadOverview ) spreadOverview.addEventListener( 'click', function() { if ( ! usesPageFocusNavigation() || activePageIndexes().length !== 2 ) return; resetZoom(); temporaryOverview = ! temporaryOverview; applyPageFocus(); updateButtons(); useMode( isRootFullscreen() ? 'fullscreen' : 'standard' ); } );
		function alignVerticalStart( startPage ) {
			stopVerticalObserver();
			const pending = new Set(), images = [], inputEvents = [ 'wheel', 'touchstart', 'pointerdown', 'keydown' ];
			let cancelled = false, frame = 0;
			function alignStart() {
				frame = window.requestAnimationFrame( function() {
					if ( cancelled || ! isVerticalReading() || ! isRootFullscreen() ) return;
					const target = pages[ startPage ], rootRect = root.getBoundingClientRect();
					if ( target ) root.scrollTop += target.getBoundingClientRect().top - rootRect.top - 16;
					startVerticalObserver();
				} );
			}
			function settled( event ) { pending.delete( event.target ); if ( ! cancelled && ! pending.size ) alignStart(); }
			// Input hands control to the reader immediately; late images must not pull them back.
			function releaseStart() { startVerticalObserver(); }
			verticalStartCleanup = function() {
				cancelled = true; window.cancelAnimationFrame( frame );
				inputEvents.forEach( function( type ) { root.removeEventListener( type, releaseStart, true ); } );
				images.forEach( function( item ) { item.image.removeEventListener( 'load', settled ); item.image.removeEventListener( 'error', settled ); if ( item.loading === null ) item.image.removeAttribute( 'loading' ); else item.image.setAttribute( 'loading', item.loading ); } );
			};
			inputEvents.forEach( function( type ) { root.addEventListener( type, releaseStart, { capture: true, passive: true } ); } );
			// Unknown image heights before the requested page must settle once, before alignment.
			pages.slice( 0, startPage + 1 ).forEach( function( page ) {
				const image = page.querySelector( 'img' );
				if ( ! image || image.complete || ( Number( image.getAttribute( 'width' ) ) > 0 && Number( image.getAttribute( 'height' ) ) > 0 ) ) return;
				pending.add( image ); images.push( { image: image, loading: image.getAttribute( 'loading' ) } );
				image.addEventListener( 'load', settled ); image.addEventListener( 'error', settled ); image.setAttribute( 'loading', 'eager' );
			} );
			if ( ! pending.size ) alignStart();
		}
		function enterVerticalReading() {
			stopVerticalObserver();
			verticalCurrentPage = readingPageIndex(); resetZoom(); root.classList.add( 'is-vertical-reading' ); applyVerticalZoom( false ); applyPageFocus(); updateButtons(); useMode( 'vertical' );
			alignVerticalStart( verticalCurrentPage );
		}
		function leaveVerticalReading() {
			stopVerticalObserver(); root.classList.remove( 'is-vertical-reading', 'is-vertical-zoomed' ); root.style.removeProperty( '--amv-reader-vertical-width' ); root.scrollTop = 0; root.scrollLeft = 0;
			activateView( viewForPage( verticalCurrentPage ), verticalCurrentPage ); updateButtons();
		}
		const fullscreen = root.querySelector( '.amv-reader__fullscreen' );
		if ( fullscreen ) {
			function restoreFullscreenScrollPosition() { if ( fullscreenReturnViewportTop === null ) return; const targetViewportTop = fullscreenReturnViewportTop; fullscreenReturnViewportTop = null; assisting = true; window.requestAnimationFrame( function() { window.requestAnimationFrame( function() { const top = Math.max( 0, window.scrollY + root.getBoundingClientRect().top - targetViewportTop ); window.scrollTo( 0, top ); window.setTimeout( function() { assisting = false; }, 260 ); } ); } ); }
			function restoreFullscreenFocus() { const target = fullscreenReturnFocus; fullscreenReturnFocus = null; if ( ! target || typeof target.focus !== 'function' ) return; window.requestAnimationFrame( function() { window.requestAnimationFrame( function() { target.focus(); } ); } ); }
			function updateFullscreen() { cancelNavigationAnimation(); const wasActive = root.classList.contains( 'is-fullscreen' ); const wasVertical = isVerticalReading(); const active = isRootFullscreen(); syncReaderVisibility(); warmAdjacentViews(); const completed = wasActive && ! active && ( wasVertical ? verticalCurrentPage === pages.length - 1 : finalPageIsVisible() ); root.classList.toggle( 'is-fullscreen', active ); fullscreen.setAttribute( 'aria-pressed', active ? 'true' : 'false' ); fullscreen.textContent = active ? __( 'Exit fullscreen', 'mangafocus' ) : __( 'Read in fullscreen', 'mangafocus' ); if ( ! active ) { if ( wasVertical ) leaveVerticalReading(); if ( completed ) returnToFirstPage(); else { resetZoom(); setActiveMode( 'standard', 'fullscreen' ); } if ( wasActive ) { restoreFullscreenScrollPosition(); restoreFullscreenFocus(); } } else if ( fullscreenReadingMode === 'vertical' ) enterVerticalReading(); else { updateButtons(); useMode( 'fullscreen' ); } if ( active ) discoverImageDimensions(); window.requestAnimationFrame( function() { updateFullscreenSpreadSizing(); applyPageFocus(); updateInlineNavigation(); } ); if ( active ) stage.focus(); if ( extensionReady && active !== lastPublicFullscreen ) { lastPublicFullscreen = active; dispatchPublicEvent( 'amv:viewer-fullscreenchange', { fullscreen: active, readingMode: publicMode() } ); notifyViewChange( 'fullscreen' ); } }
			function requestRootFullscreen( trigger, startAtFirstPage ) { if ( document.fullscreenElement === root ) { const exitRequest = document.exitFullscreen(); if ( exitRequest && typeof exitRequest.catch === 'function' ) exitRequest.catch( function() {} ); return; } fullscreenReturnViewportTop = root.getBoundingClientRect().top; fullscreenReturnFocus = trigger || null; if ( startAtFirstPage ) returnToFirstPage(); try { const request = root.requestFullscreen(); if ( request && typeof request.catch === 'function' ) request.catch( function() { fullscreenReturnFocus = null; fullscreenReturnViewportTop = null; useInlineFallback(); } ); } catch ( error ) { fullscreenReturnFocus = null; fullscreenReturnViewportTop = null; useInlineFallback(); } }
			if ( typeof root.requestFullscreen !== 'function' || typeof document.exitFullscreen !== 'function' ) { fullscreen.hidden = true; if ( coverLauncher ) coverLauncher.hidden = true; useInlineFallback(); }
			else { fullscreen.addEventListener( 'click', function() { requestRootFullscreen( fullscreen, ! fullscreenStartAtCurrent ); } ); if ( coverLauncher ) coverLauncher.addEventListener( 'click', function() { requestRootFullscreen( coverLauncher, true ); } ); document.addEventListener( 'fullscreenchange', updateFullscreen ); updateFullscreen(); }
		}
		const publicApi = Object.freeze( {
			getRootElement: function() { return root; },
			getPageElement: function( index ) { return Number.isInteger( index ) && index >= 0 && index < pages.length ? pages[ index ] : null; },
			getIdentity: publicIdentity,
			getCurrentPage: function() { return publicPage( readingPageIndex() ); },
			getVisiblePages: publicVisiblePages,
			getState: publicState,
			setExtensionMode: function( mode, source ) {
				if ( typeof mode !== 'string' || ( mode && ! /^[a-z][a-z0-9_-]*$/.test( mode ) ) ) return false;
				cancelNavigationAnimation();
				const previous = publicMode(); extensionMode = mode; const currentMode = publicMode(); warmAdjacentViews();
				if ( previous !== currentMode ) dispatchPublicEvent( 'amv:viewer-modechange', { readingMode: currentMode, previousMode: previous, source: source || 'extension' } );
				notifyViewChange( source || 'extension' ); return true;
			},
			goToPage: function( index ) {
				const target = Number( index );
				if ( ! Number.isInteger( target ) || target < 0 || target >= pages.length ) return false;
				cancelNavigationAnimation( false );
				const pendingStart = !! verticalStartCleanup;
				resetZoom(); temporaryOverview = false; verticalCurrentPage = target; activateView( viewForPage( target ), target ); updateButtons();
				if ( isVerticalReading() ) { if ( pendingStart ) alignVerticalStart( target ); else { const page = pages[ target ]; if ( page ) root.scrollTop += page.getBoundingClientRect().top - root.getBoundingClientRect().top - 16; } }
				notifyViewChange( 'api' ); return true;
			},
			isFullscreen: isRootFullscreen,
			openFullscreen: function() { if ( ! fullscreen || fullscreen.hidden || isRootFullscreen() ) return false; fullscreen.click(); return true; },
			closeFullscreen: function() { if ( ! isRootFullscreen() || typeof document.exitFullscreen !== 'function' ) return false; exitRootFullscreen(); return true; }
		} );
		publicInstances.set( root, publicApi ); extensionReady = true; lastPublicFullscreen = isRootFullscreen();
		[ 'pointerdown', 'keydown', 'touchstart', 'wheel', 'click' ].forEach( function( type ) { root.addEventListener( type, function( event ) { dispatchPublicEvent( 'amv:viewer-interaction', { source: event.type, currentPage: publicPage( readingPageIndex() ) } ); }, { passive: true } ); } );
		dispatchPublicEvent( 'amv:viewer-ready', { state: publicState() } ); notifyViewChange( 'ready' );

	}
	document.querySelectorAll( '.wp-block-ai-manga-viewer-viewer' ).forEach( init );

} )();
