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
		const zoomControls = root.querySelector( '.amv-reader__zoom-controls' );
		const zoomOut = root.querySelector( '.amv-reader__zoom-out' );
		const zoomIn = root.querySelector( '.amv-reader__zoom-in' );
		const zoomReset = root.querySelector( '.amv-reader__zoom-reset' );
		const zoomLevel = root.querySelector( '.amv-reader__zoom-level' );
		const zoomPagePrevious = root.querySelector( '.amv-reader__zoom-page--previous' );
		const zoomPageNext = root.querySelector( '.amv-reader__zoom-page--next' );
		const coverLauncher = root.querySelector( '.amv-reader__cover-launcher-button' );
		const spreadOverview = root.querySelector( '.amv-reader__spread-overview' );
		const zoomEnabled = root.dataset.zoom === 'on' && zoomControls && zoomOut && zoomIn && zoomReset && zoomLevel;
		const fullscreenStartAtCurrent = root.dataset.fullscreenStart === 'current';
		let current = 0, currentView = 0, focusedPageIndex = 0, verticalCurrentPage = 0, temporaryOverview = false, views = pages.map( function( page, index ) { return [ index ]; } ), spreadActive = false, locked = false, scrollTimer = null, assisting = false, fullscreenReturnViewportTop = null, fullscreenReturnFocus = null, zoomScale = 1, panX = 0, panY = 0, panPointer = null, touchPan = null, pinch = null, verticalObserver = null, verticalVisibility = {};
		const viewerKey = root.dataset.viewerKey || '', instanceKey = root.dataset.instanceKey || '';
		let activeMode = 'standard', extensionMode = '';
		let extensionReady = false, lastPublicView = '', lastPublicFullscreen = false;
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
		function publicVisiblePages() { return ( isVerticalReading() ? [ verticalCurrentPage ] : reachablePageIndexes() ).map( publicPage ).filter( Boolean ); }
		function publicMode() { return extensionMode || activeMode; }
		function publicIdentity() { return { viewerKey: viewerKey, instanceKey: instanceKey }; }
		function publicState() { return { identity: publicIdentity(), currentPage: publicPage( readingPageIndex() ), visiblePages: publicVisiblePages(), layout: spreadActive ? 'spread' : 'single', spreadMode: spreadReadingMode, readingMode: publicMode(), fullscreen: isRootFullscreen() }; }
		function dispatchPublicEvent( name, detail ) { if ( ! extensionReady ) return; root.dispatchEvent( new window.CustomEvent( name, { bubbles: true, detail: Object.assign( { apiVersion: extensionApiVersion, identity: publicIdentity() }, detail || {} ) } ) ); }
		function notifyViewChange( source ) { if ( ! extensionReady ) return; const state = publicState(); const signature = JSON.stringify( { currentPage: state.currentPage, visiblePages: state.visiblePages, layout: state.layout, spreadMode: state.spreadMode, readingMode: state.readingMode } ); if ( signature === lastPublicView ) return; lastPublicView = signature; dispatchPublicEvent( 'amv:viewer-viewchange', { currentPage: state.currentPage, visiblePages: state.visiblePages, layout: state.layout, spreadMode: state.spreadMode, readingMode: state.readingMode, source: source || 'reader' } ); }
		function setActiveMode( mode, source ) { const previous = publicMode(); activeMode = mode; const currentMode = publicMode(); if ( previous !== currentMode ) dispatchPublicEvent( 'amv:viewer-modechange', { readingMode: currentMode, previousMode: previous, source: source || 'reader' } ); }
		function updatePageAccessibility() {
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
			if ( spreadOverview ) { spreadOverview.hidden = ! hasFocusedSpread; spreadOverview.setAttribute( 'aria-pressed', temporaryOverview ? 'true' : 'false' ); spreadOverview.textContent = temporaryOverview ? __( 'ページ表示に戻る', 'ai-manga-viewer' ) : __( '見開き全体を見る', 'ai-manga-viewer' ); }
			updatePageAccessibility();
			if ( ! hasFocusedSpread || temporaryOverview ) return;
			const viewport = root.querySelector( '.amv-reader__pages' ); const page = pages[ focusedPageIndex ];
			if ( ! viewport || ! page ) return;
			const viewportRect = viewport.getBoundingClientRect(); const pageWidth = page.offsetWidth; const pageHeight = page.offsetHeight;
			if ( ! viewportRect.width || ! pageWidth || ! pageHeight ) return;
			const availableHeight = Math.max( 1, window.innerHeight - pageFocusViewportReserve );
			const targetWidth = Math.min( viewportRect.width, availableHeight * pageWidth / pageHeight );
			const fitScale = targetWidth / pageWidth; const targetHeight = pageHeight * fitScale;
			const pageX = surface.offsetLeft + page.offsetLeft; const pageY = surface.offsetTop + page.offsetTop;
			const translateX = ( viewportRect.width - targetWidth ) / 2 - pageX * fitScale; const translateY = -pageY * fitScale;
			viewport.style.height = targetHeight + 'px'; focusLayer.style.transformOrigin = '0 0'; focusLayer.style.transform = 'translate3d(' + translateX + 'px,' + translateY + 'px,0) scale(' + fitScale + ')';
			if ( surface.offsetWidth && surface.offsetHeight ) surface.style.transformOrigin = ( ( page.offsetLeft + pageWidth / 2 ) / surface.offsetWidth * 100 ) + '% ' + ( ( page.offsetTop + pageHeight / 2 ) / surface.offsetHeight * 100 ) + '%';
		}
		function activateView( viewIndex, preferredPage ) {
			currentView = clamp( viewIndex, 0, Math.max( 0, views.length - 1 ) );
			const active = activePageIndexes(); focusedPageIndex = active.indexOf( preferredPage ) !== -1 ? preferredPage : active[ 0 ] || 0; current = focusedPageIndex;
			pages.forEach( function( page, index ) { page.classList.toggle( 'is-active', active.indexOf( index ) !== -1 ); page.classList.remove( 'is-under', 'is-leaving', 'is-leaving-next', 'is-leaving-previous', 'is-spread-first', 'is-spread-second' ); } );
			if ( active.length === 2 ) { pages[ active[ 0 ] ].classList.add( 'is-spread-first' ); pages[ active[ 1 ] ].classList.add( 'is-spread-second' ); }
			root.classList.toggle( 'is-spread-view', active.length === 2 );
			window.requestAnimationFrame( function() { updateFullscreenSpreadSizing(); applyPageFocus(); } );
			notifyViewChange( 'navigation' );
		}
		function updateFullscreenSpreadSizing() {
			pages.forEach( function( page ) { page.style.removeProperty( '--amv-reader-fullscreen-page-width' ); } );
			if ( ! isRootFullscreen() || isVerticalReading() || ! root.classList.contains( 'is-spread-view' ) ) return;
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
		function rebuildViews( preservePage ) { const target = clamp( preservePage, 0, pages.length - 1 ); views = buildViews(); temporaryOverview = false; activateView( viewForPage( target ), target ); updateButtons(); applyZoom(); }
		function updateLayoutForWidth( width ) {
			if ( configuredLayout === 'single' ) { if ( spreadActive ) { spreadActive = false; root.classList.remove( 'has-spread-layout' ); rebuildViews( current ); } return; }
			const threshold = layoutThresholds[ configuredLayout ]; const nextSpread = spreadActive ? width >= threshold.exit : width >= threshold.enter;
			if ( nextSpread === spreadActive ) return;
			const preservePage = focusedPageIndex; resetZoom(); spreadActive = nextSpread; root.classList.toggle( 'has-spread-layout', spreadActive ); rebuildViews( preservePage );
		}
		function discoverImageDimensions() {
			pages.forEach( function( page ) {
				if ( Number( page.dataset.imageWidth ) > 0 && Number( page.dataset.imageHeight ) > 0 ) return;
				const source = page.querySelector( 'img' );
				function remember( image ) { if ( ! image || ! image.naturalWidth || ! image.naturalHeight ) return; const wasLandscape = pageIsLandscape( Number( page.dataset.pageIndex ) ); page.dataset.imageWidth = String( image.naturalWidth ); page.dataset.imageHeight = String( image.naturalHeight ); if ( spreadActive && wasLandscape !== pageIsLandscape( Number( page.dataset.pageIndex ) ) ) rebuildViews( focusedPageIndex ); else window.requestAnimationFrame( function() { updateFullscreenSpreadSizing(); applyPageFocus(); } ); }
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
			if ( typeof window.IntersectionObserver !== 'function' ) return;
			verticalObserver = new window.IntersectionObserver( function( entries ) {
				entries.forEach( function( entry ) {
					const index = Number( entry.target.dataset.pageIndex ); const visibleHeight = entry.isIntersecting ? entry.intersectionRect.height : 0;
					verticalVisibility[ index ] = { visible: visibleHeight, center: entry.boundingClientRect.top + entry.boundingClientRect.height / 2 };
				} );
				updateVerticalCurrentPage();
			}, { root: root, threshold: [ 0, .1, .25, .5, .75, 1 ] } );
			pages.forEach( function( page ) { verticalObserver.observe( page ); } );
		}
		function isRootFullscreen() { return document.fullscreenElement === root; }
		function exitRootFullscreen() { const request = document.exitFullscreen(); if ( request && typeof request.catch === 'function' ) request.catch( function() {} ); }
		function activeCanvas() { return surface; }
		function verticalBaseWidth() {
			const configured = parseFloat( window.getComputedStyle( root ).getPropertyValue( '--amv-reader-max-width' ) ) || 650;
			const padding = window.matchMedia( '(max-width: 600px)' ).matches ? 24 : 32;
			return Math.max( 1, Math.min( configured, root.clientWidth - padding ) );
		}
		function applyVerticalZoom( preserveAnchor ) {
			if ( ! isVerticalReading() ) return;
			const anchor = pages[ verticalCurrentPage ]; const rootTop = root.getBoundingClientRect().top; const previousTop = anchor ? anchor.getBoundingClientRect().top - rootTop : 0;
			const width = verticalBaseWidth() * zoomScale;
			root.style.setProperty( '--amv-reader-vertical-width', width + 'px' );
			root.classList.toggle( 'is-vertical-zoomed', zoomScale > 1 );
			zoomLevel.textContent = Math.round( zoomScale * 100 ) + '%'; zoomOut.disabled = zoomScale <= 1; zoomIn.disabled = zoomScale >= verticalZoomMaximum; zoomReset.disabled = zoomScale <= 1;
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
			root.classList.toggle( 'is-zoomed', zoomScale > 1 ); zoomLevel.textContent = Math.round( zoomScale * 100 ) + '%'; zoomOut.disabled = zoomScale <= 1; zoomIn.disabled = zoomScale >= 3; zoomReset.disabled = zoomScale <= 1;
			updateButtons();
		}
		function setZoom( value ) { if ( ! zoomEnabled ) return; const vertical = isVerticalReading(); const previousScale = zoomScale; zoomScale = clamp( Math.round( value * 100 ) / 100, 1, vertical ? verticalZoomMaximum : 3 ); if ( zoomScale === 1 ) { panX = 0; panY = 0; } applyZoom(); if ( vertical ) setActiveMode( 'vertical', 'zoom' ); else if ( previousScale <= 1 && zoomScale > 1 ) useMode( 'zoom' ); else if ( previousScale > 1 && zoomScale === 1 ) setActiveMode( isRootFullscreen() ? 'fullscreen' : 'standard', 'zoom-reset' ); }
		function resetZoom() { if ( ! zoomEnabled ) return; const vertical = isVerticalReading(); const canvas = activeCanvas(); if ( canvas ) canvas.style.transform = ''; zoomScale = 1; panX = 0; panY = 0; root.classList.remove( 'is-zoomed', 'is-vertical-zoomed', 'is-panning' ); zoomLevel.textContent = '100%'; zoomOut.disabled = true; zoomIn.disabled = false; zoomReset.disabled = true; if ( vertical ) applyVerticalZoom( true ); updateButtons(); }
		function panBy( dx, dy ) { if ( zoomScale <= 1 ) return; panX += dx; panY += dy; applyZoom(); }
		function updateButtons() { if ( isVerticalReading() ) { if ( count ) count.textContent = ( verticalCurrentPage + 1 ) + ' / ' + pages.length; stage.setAttribute( 'aria-label', sprintf( __( '%dページ目付近を表示中。上下にスクロールして読めます', 'ai-manga-viewer' ), verticalCurrentPage + 1 ) ); return; } const zoomed = zoomScale > 1; const pageNavigation = usesPageFocusNavigation(); const atEnd = pageNavigation ? focusedPageIndex === pages.length - 1 : currentView === views.length - 1; const atStart = pageNavigation ? focusedPageIndex === 0 : currentView === 0; const nextExitsFullscreen = atEnd && isRootFullscreen() && ! zoomed; const zoomNextExitsFullscreen = atEnd && isRootFullscreen() && zoomed; root.classList.toggle( 'is-first-page', atStart ); Array.prototype.forEach.call( buttons.previous, function( button ) { button.disabled = zoomed || atStart; } ); Array.prototype.forEach.call( buttons.next, function( button ) { button.disabled = zoomed || ( atEnd && ! nextExitsFullscreen ); button.setAttribute( 'aria-label', nextExitsFullscreen ? __( '全画面を終了', 'ai-manga-viewer' ) : __( '次のページ', 'ai-manga-viewer' ) ); } ); if ( zoomPagePrevious ) zoomPagePrevious.disabled = atStart; if ( zoomPageNext ) { zoomPageNext.disabled = atEnd && ! zoomNextExitsFullscreen; zoomPageNext.setAttribute( 'aria-label', zoomNextExitsFullscreen ? __( 'ズームを解除して全画面を終了', 'ai-manga-viewer' ) : __( 'ズームを解除して次のページ', 'ai-manga-viewer' ) ); } const active = activePageIndexes(); const focusedOnly = pageFocusVisible(); if ( count ) count.textContent = focusedOnly ? ( focusedPageIndex + 1 ) + ' / ' + pages.length : ( active.length === 2 ? ( active[ 0 ] + 1 ) + '–' + ( active[ 1 ] + 1 ) + ' / ' + pages.length : ( active[ 0 ] + 1 ) + ' / ' + pages.length ); stage.setAttribute( 'aria-label', focusedOnly ? sprintf( __( '%dページ目を拡大表示中。左右キーまたはスワイプで送れます', 'ai-manga-viewer' ), focusedPageIndex + 1 ) : ( active.length === 2 ? sprintf( __( '%1$dページ目と%2$dページ目を表示中。左右キーまたはスワイプで送れます', 'ai-manga-viewer' ), active[ 0 ] + 1, active[ 1 ] + 1 ) : sprintf( __( '%dページ目を表示中。左右キーまたはスワイプで送れます', 'ai-manga-viewer' ), active[ 0 ] + 1 ) ) ); }
		function finalPageIsVisible() { return activePageIndexes().indexOf( pages.length - 1 ) !== -1; }
		function returnToFirstPage() { const vertical = isVerticalReading(); resetZoom(); temporaryOverview = false; verticalCurrentPage = 0; activateView( viewForPage( 0 ), 0 ); if ( vertical ) root.scrollTop = 0; updateButtons(); setActiveMode( vertical ? 'vertical' : 'standard', 'return-to-start' ); }
		function finishViewChange( nextView, readingMode ) { activateView( nextView ); locked = false; updateButtons(); setActiveMode( isVerticalReading() ? 'vertical' : ( isRootFullscreen() ? 'fullscreen' : 'standard' ), 'navigation' ); }
		function change( nextView ) {
			nextView = clamp( nextView, 0, views.length - 1 ); if ( nextView === currentView || locked || zoomScale > 1 ) return;
			const readingMode = isRootFullscreen() ? 'fullscreen' : ( activeMode === 'zoom' ? 'zoom' : 'standard' ); useMode( readingMode ); resetZoom();
			if ( spreadActive ) { locked = true; finishViewChange( nextView, readingMode ); return; }
			const direction = nextView > currentView ? 'next' : 'previous'; const oldPage = pages[ current ], newPage = pages[ views[ nextView ][ 0 ] ]; locked = true; newPage.classList.add( 'is-active', 'is-under' ); oldPage.classList.add( 'is-leaving', 'is-leaving-' + direction ); root.classList.add( 'is-turning' );
			window.setTimeout( function() { root.classList.remove( 'is-turning' ); finishViewChange( nextView, readingMode ); }, root.dataset.animation === 'off' ? 0 : duration );
		}
		function moveFocusedPage( offset ) { const target = clamp( focusedPageIndex + offset, 0, pages.length - 1 ); if ( target === focusedPageIndex || locked || zoomScale > 1 ) return; const readingMode = isRootFullscreen() ? 'fullscreen' : ( activeMode === 'zoom' ? 'zoom' : 'standard' ); const targetView = viewForPage( target ); useMode( readingMode ); resetZoom(); temporaryOverview = false; locked = true; if ( targetView !== currentView ) root.classList.add( 'is-focus-surface-changing' ); activateView( targetView, target ); locked = false; updateButtons(); setActiveMode( isVerticalReading() ? 'vertical' : ( isRootFullscreen() ? 'fullscreen' : 'standard' ), 'navigation' ); window.setTimeout( function() { root.classList.remove( 'is-focus-surface-changing' ); }, 220 ); }
		function previous() { if ( isVerticalReading() || zoomScale > 1 ) return; if ( usesPageFocusNavigation() ) { moveFocusedPage( -1 ); return; } change( currentView - 1 ); } function next() { if ( isVerticalReading() || zoomScale > 1 ) return; const atEnd = usesPageFocusNavigation() ? focusedPageIndex === pages.length - 1 : currentView === views.length - 1; if ( atEnd && isRootFullscreen() ) { exitRootFullscreen(); return; } if ( usesPageFocusNavigation() ) { moveFocusedPage( 1 ); return; } change( currentView + 1 ); }
		Array.prototype.forEach.call( buttons.previous, function( button ) { button.addEventListener( 'click', previous ); } ); Array.prototype.forEach.call( buttons.next, function( button ) { button.addEventListener( 'click', next ); } );
		stage.addEventListener( 'keydown', function( event ) {
			if ( zoomEnabled && ( event.key === '+' || event.key === '=' ) ) { event.preventDefault(); setZoom( zoomScale + .25 ); return; }
			if ( zoomEnabled && ( event.key === '-' || event.key === '_' ) ) { event.preventDefault(); setZoom( zoomScale - .25 ); return; }
			if ( zoomEnabled && event.key === '0' ) { event.preventDefault(); resetZoom(); setActiveMode( isVerticalReading() ? 'vertical' : ( isRootFullscreen() ? 'fullscreen' : 'standard' ), 'keyboard' ); return; }
			if ( isVerticalReading() ) return;
			if ( zoomScale > 1 && [ 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown' ].indexOf( event.key ) !== -1 ) { event.preventDefault(); panBy( event.key === 'ArrowLeft' ? 40 : ( event.key === 'ArrowRight' ? -40 : 0 ), event.key === 'ArrowUp' ? 40 : ( event.key === 'ArrowDown' ? -40 : 0 ) ); return; }
			if ( event.key === 'ArrowLeft' ) { event.preventDefault(); binding === 'rtl' ? next() : previous(); } if ( event.key === 'ArrowRight' ) { event.preventDefault(); binding === 'rtl' ? previous() : next(); }
		} );
		bindSwipe( stage, 40, function( dx ) { if ( isVerticalReading() || zoomScale > 1 ) return; ( binding === 'rtl' ? dx > 0 : dx < 0 ) ? next() : previous(); } );
		if ( zoomEnabled ) {
			zoomOut.addEventListener( 'click', function() { setZoom( zoomScale - .25 ); } ); zoomIn.addEventListener( 'click', function() { setZoom( zoomScale + .25 ); } ); zoomReset.addEventListener( 'click', function() { resetZoom(); setActiveMode( isVerticalReading() ? 'vertical' : ( isRootFullscreen() ? 'fullscreen' : 'standard' ), 'zoom-reset' ); } );
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
		if ( root.dataset.scrollAssist === 'on' && ! window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ) window.addEventListener( 'scroll', function() { if ( assisting ) return; window.clearTimeout( scrollTimer ); scrollTimer = window.setTimeout( function() { const rect = stage.getBoundingClientRect(), viewportHeight = window.innerHeight || document.documentElement.clientHeight, visible = Math.min( rect.bottom, viewportHeight ) - Math.max( rect.top, 0 ); if ( visible < Math.min( 160, Math.min( rect.height, viewportHeight ) * .28 ) ) return; const position = [ 'auto', 'top', 'center' ].indexOf( root.dataset.scrollPosition ) !== -1 ? root.dataset.scrollPosition : 'auto', strength = [ 'gentle', 'normal', 'strong' ].indexOf( root.dataset.scrollStrength ) !== -1 ? root.dataset.scrollStrength : 'normal', values = { gentle: { threshold: 150, amount: .45 }, normal: { threshold: 300, amount: .72 }, strong: { threshold: 520, amount: 1 } }[ strength ], centeredTarget = Math.max( 24, ( viewportHeight - rect.height ) / 2 ), target = position === 'top' ? 24 : ( position === 'center' ? centeredTarget : ( rect.height <= viewportHeight * .84 ? centeredTarget : 24 ) ), offset = rect.top - target; if ( Math.abs( offset ) < 8 || Math.abs( offset ) > values.threshold ) return; assisting = true; window.scrollTo( { top: Math.max( 0, window.scrollY + offset * values.amount ), behavior: 'smooth' } ); window.setTimeout( function() { assisting = false; }, 500 ); }, 160 ); }, { passive: true } );
		activateView( 0 );
		updateLayoutForWidth( root.getBoundingClientRect().width );
		discoverImageDimensions();
		if ( typeof window.ResizeObserver === 'function' ) new window.ResizeObserver( function( entries ) { if ( entries[ 0 ] ) { updateLayoutForWidth( entries[ 0 ].contentRect.width ); window.requestAnimationFrame( function() { updateFullscreenSpreadSizing(); applyPageFocus(); } ); } } ).observe( root );
		else window.addEventListener( 'resize', function() { updateLayoutForWidth( root.getBoundingClientRect().width ); window.requestAnimationFrame( function() { updateFullscreenSpreadSizing(); applyPageFocus(); } ); } );
		window.addEventListener( 'resize', function() { window.requestAnimationFrame( function() { updateFullscreenSpreadSizing(); applyPageFocus(); } ); } );
		updateButtons();
		if ( spreadOverview ) spreadOverview.addEventListener( 'click', function() { if ( ! usesPageFocusNavigation() || activePageIndexes().length !== 2 ) return; resetZoom(); temporaryOverview = ! temporaryOverview; applyPageFocus(); updateButtons(); useMode( isRootFullscreen() ? 'fullscreen' : 'standard' ); } );
		function enterVerticalReading() {
			verticalCurrentPage = readingPageIndex(); resetZoom(); root.classList.add( 'is-vertical-reading' ); applyVerticalZoom( false ); applyPageFocus(); updateButtons(); useMode( 'vertical' );
			window.requestAnimationFrame( function() {
				const target = pages[ verticalCurrentPage ]; const rootRect = root.getBoundingClientRect();
				if ( target ) root.scrollTop += target.getBoundingClientRect().top - rootRect.top - 16;
				startVerticalObserver();
			} );
		}
		function leaveVerticalReading() {
			stopVerticalObserver(); root.classList.remove( 'is-vertical-reading', 'is-vertical-zoomed' ); root.style.removeProperty( '--amv-reader-vertical-width' ); root.scrollTop = 0; root.scrollLeft = 0;
			activateView( viewForPage( verticalCurrentPage ), verticalCurrentPage ); updateButtons();
		}
		const fullscreen = root.querySelector( '.amv-reader__fullscreen' );
		if ( fullscreen ) {
			function restoreFullscreenScrollPosition() { if ( fullscreenReturnViewportTop === null ) return; const targetViewportTop = fullscreenReturnViewportTop; fullscreenReturnViewportTop = null; assisting = true; window.requestAnimationFrame( function() { window.requestAnimationFrame( function() { const top = Math.max( 0, window.scrollY + root.getBoundingClientRect().top - targetViewportTop ); window.scrollTo( 0, top ); window.setTimeout( function() { assisting = false; }, 260 ); } ); } ); }
			function restoreFullscreenFocus() { const target = fullscreenReturnFocus; fullscreenReturnFocus = null; if ( ! target || typeof target.focus !== 'function' ) return; window.requestAnimationFrame( function() { window.requestAnimationFrame( function() { target.focus(); } ); } ); }
			function updateFullscreen() { const wasActive = root.classList.contains( 'is-fullscreen' ); const wasVertical = isVerticalReading(); const active = isRootFullscreen(); const completed = wasActive && ! active && ( wasVertical ? verticalCurrentPage === pages.length - 1 : finalPageIsVisible() ); root.classList.toggle( 'is-fullscreen', active ); fullscreen.setAttribute( 'aria-pressed', active ? 'true' : 'false' ); fullscreen.textContent = active ? __( '全画面を終了', 'ai-manga-viewer' ) : __( '全画面で読む', 'ai-manga-viewer' ); if ( ! active ) { if ( wasVertical ) leaveVerticalReading(); if ( completed ) returnToFirstPage(); else { resetZoom(); setActiveMode( 'standard', 'fullscreen' ); } if ( wasActive ) { restoreFullscreenScrollPosition(); restoreFullscreenFocus(); } } else if ( fullscreenReadingMode === 'vertical' ) enterVerticalReading(); else { updateButtons(); useMode( 'fullscreen' ); } window.requestAnimationFrame( function() { updateFullscreenSpreadSizing(); applyPageFocus(); } ); if ( active ) stage.focus(); if ( extensionReady && active !== lastPublicFullscreen ) { lastPublicFullscreen = active; dispatchPublicEvent( 'amv:viewer-fullscreenchange', { fullscreen: active, readingMode: publicMode() } ); notifyViewChange( 'fullscreen' ); } }
			function requestRootFullscreen( trigger, startAtFirstPage ) { if ( document.fullscreenElement === root ) { const exitRequest = document.exitFullscreen(); if ( exitRequest && typeof exitRequest.catch === 'function' ) exitRequest.catch( function() {} ); return; } fullscreenReturnViewportTop = root.getBoundingClientRect().top; fullscreenReturnFocus = trigger || null; if ( startAtFirstPage ) returnToFirstPage(); const request = root.requestFullscreen(); if ( request && typeof request.catch === 'function' ) request.catch( function() { fullscreenReturnFocus = null; fullscreenReturnViewportTop = null; } ); }
			if ( typeof root.requestFullscreen !== 'function' || typeof document.exitFullscreen !== 'function' ) { fullscreen.hidden = true; if ( coverLauncher ) coverLauncher.hidden = true; }
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
				const previous = publicMode(); extensionMode = mode; const currentMode = publicMode();
				if ( previous !== currentMode ) dispatchPublicEvent( 'amv:viewer-modechange', { readingMode: currentMode, previousMode: previous, source: source || 'extension' } );
				notifyViewChange( source || 'extension' ); return true;
			},
			goToPage: function( index ) {
				const target = Number( index );
				if ( ! Number.isInteger( target ) || target < 0 || target >= pages.length ) return false;
				resetZoom(); temporaryOverview = false; verticalCurrentPage = target; activateView( viewForPage( target ), target ); updateButtons();
				if ( isVerticalReading() ) { const page = pages[ target ]; if ( page ) root.scrollTop += page.getBoundingClientRect().top - root.getBoundingClientRect().top - 16; }
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
