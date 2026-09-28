( function() {
	'use strict';
	const duration = 360;
	const layout = window.aiMangaViewerLayout;
	function clamp( value, min, max ) { return Math.max( min, Math.min( max, value ) ); }
	function runtimeId( prefix ) { if ( window.crypto && typeof window.crypto.randomUUID === 'function' ) return prefix + '-' + window.crypto.randomUUID(); return prefix + '-' + Date.now().toString( 36 ) + '-' + Math.random().toString( 36 ).slice( 2, 12 ); }
	function parseAreas( page, mobile ) { try { const value = JSON.parse( mobile ? ( page.dataset.mobileFocusAreas || '[]' ) : ( page.dataset.focusAreas || '[]' ) ); return Array.isArray( value ) ? value : []; } catch ( error ) { return []; } }
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
		const openFocus = root.querySelector( '.amv-reader__focus-open' );
		const spreadOverview = root.querySelector( '.amv-reader__spread-overview' );
		const modal = root.querySelector( '.amv-modal' );
		const zoomEnabled = root.dataset.zoom === 'on' && zoomControls && zoomOut && zoomIn && zoomReset && zoomLevel;
		let current = 0, currentView = 0, focusedPageIndex = 0, temporaryOverview = false, views = pages.map( function( page, index ) { return [ index ]; } ), spreadActive = false, locked = false, scrollTimer = null, assisting = false, fullscreenReturnViewportTop = null, zoomScale = 1, panX = 0, panY = 0, panPointer = null, touchPan = null, pinch = null;
		const keyPattern = /^[a-z0-9_-]{1,64}$/, viewerKey = root.dataset.viewerKey || '', instanceKey = root.dataset.instanceKey || '', analyticsReady = root.dataset.analyticsSource === 'library' && keyPattern.test( viewerKey ) && keyPattern.test( instanceKey ) && pages.every( function( page ) { return keyPattern.test( page.dataset.pageKey || '' ); } ), reachedPages = {}, usedModes = {};
		let readingStarted = false, readingSessionId = '', anonymousVisitorId = '', activeMode = 'standard', activeTimer = null, activeMilliseconds = 0, activeSecondsSent = 0, lastActiveTick = Date.now(), lastReaderActivity = 0, lastSessionPersisted = 0;
		let readerIntersecting = typeof window.IntersectionObserver !== 'function', impressionVisible = false, impressionTimer = null, impressionSent = false;
		root.classList.add( 'is-enhanced' );
		function pageIsLandscape( index ) { const page = pages[ index ]; if ( ! page ) return false; return layout.dimensionState( { width: page.dataset.imageWidth, height: page.dataset.imageHeight } ) === 'landscape'; }
		function buildViews() {
			if ( ! spreadActive ) return pages.map( function( page, index ) { return [ index ]; } );
			return layout.buildViews( pages.length, singleFirstPage, pageIsLandscape );
		}
		function activePageIndexes() { return views[ currentView ] || [ current ]; }
		function viewForPage( pageIndex ) { const found = views.findIndex( function( view ) { return view.indexOf( pageIndex ) !== -1; } ); return found === -1 ? 0 : found; }
		function usesPageFocusNavigation() { return spreadReadingMode === 'pageFocus' && spreadActive; }
		function pageFocusVisible() { return usesPageFocusNavigation() && activePageIndexes().length === 2 && ! temporaryOverview; }
		function readingPageIndex() { return pageFocusVisible() ? focusedPageIndex : current; }
		function reachablePageIndexes() { return pageFocusVisible() ? [ focusedPageIndex ] : activePageIndexes(); }
		function updatePageAccessibility() {
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
			const active = activePageIndexes(); const hasFocusedSpread = usesPageFocusNavigation() && active.length === 2;
			root.classList.toggle( 'is-page-focus', hasFocusedSpread ); root.classList.toggle( 'is-temporary-overview', hasFocusedSpread && temporaryOverview );
			if ( spreadOverview ) { spreadOverview.hidden = ! hasFocusedSpread; spreadOverview.setAttribute( 'aria-pressed', temporaryOverview ? 'true' : 'false' ); spreadOverview.textContent = temporaryOverview ? 'ページ表示に戻る' : '見開き全体を見る'; }
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
		}
		function updateFullscreenSpreadSizing() {
			pages.forEach( function( page ) { page.style.removeProperty( '--amv-reader-fullscreen-page-width' ); } );
			if ( ! isRootFullscreen() || ! root.classList.contains( 'is-spread-view' ) ) return;
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
		function reachVisiblePages( mode ) { reachablePageIndexes().forEach( function( index ) { reachPage( index, mode ); } ); }
		function rebuildViews( preservePage ) { const target = clamp( preservePage, 0, pages.length - 1 ); views = buildViews(); temporaryOverview = false; activateView( viewForPage( target ), target ); updateButtons(); applyZoom(); if ( readingStarted ) reachVisiblePages( activeMode ); }
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
		function pageData( index ) { const page = pages[ index ]; return { pageIndex: index, pageNumber: index + 1, pageKey: page ? ( page.dataset.pageKey || '' ) : '', pageCount: pages.length }; }
		function analyticsCollectionEnabled() { const config = window.aiMangaViewerAnalytics; return !! ( config && config.enabled ); }
		function visitorId() {
			if ( anonymousVisitorId ) return anonymousVisitorId;
			if ( analyticsCollectionEnabled() ) {
				try { const stored = window.localStorage.getItem( 'ai_manga_viewer_visitor_id' ); if ( keyPattern.test( stored || '' ) && stored.length <= 80 ) anonymousVisitorId = stored; } catch ( error ) {}
			}
			if ( ! anonymousVisitorId ) anonymousVisitorId = runtimeId( 'visitor' );
			if ( analyticsCollectionEnabled() ) { try { window.localStorage.setItem( 'ai_manga_viewer_visitor_id', anonymousVisitorId ); } catch ( error ) {} }
			return anonymousVisitorId;
		}
		function sessionStorageKey() { return 'ai_manga_viewer_session_' + viewerKey + '_' + instanceKey; }
		function resumableSessionId() {
			if ( ! analyticsCollectionEnabled() ) return '';
			try {
				const stored = JSON.parse( window.localStorage.getItem( sessionStorageKey() ) || 'null' );
				if ( stored && keyPattern.test( stored.sessionId || '' ) && stored.sessionId.length <= 80 && stored.visitorId === visitorId() && Number.isInteger( stored.lastActivity ) && Date.now() - stored.lastActivity >= 0 && Date.now() - stored.lastActivity <= 1800000 ) return stored.sessionId;
			} catch ( error ) {}
			return '';
		}
		function rememberSession( force ) {
			if ( ! analyticsCollectionEnabled() || ! readingSessionId ) return;
			const now = Date.now(); if ( ! force && now - lastSessionPersisted < 10000 ) return; lastSessionPersisted = now;
			try { window.localStorage.setItem( sessionStorageKey(), JSON.stringify( { sessionId: readingSessionId, visitorId: visitorId(), lastActivity: now } ) ); } catch ( error ) {}
		}
		function emitReaderEvent( name, detail ) { if ( ! analyticsReady ) return; root.dispatchEvent( new CustomEvent( 'amv:reader-event', { bubbles: true, detail: Object.assign( { name: name, eventId: runtimeId( 'event' ), sessionId: readingSessionId, visitorId: analyticsCollectionEnabled() ? visitorId() : '', viewerKey: viewerKey, instanceKey: instanceKey, occurredAt: Date.now() }, detail || {} ) } ) ); }
		function recordImpression() {
			if ( impressionSent || ! analyticsReady ) return;
			impressionSent = true;
			if ( impressionTimer ) { window.clearTimeout( impressionTimer ); impressionTimer = null; }
			emitReaderEvent( 'viewer_impression', Object.assign( { sessionId: '', mode: 'standard', readingStarted: false }, pageData( readingPageIndex() ) ) );
		}
		function updateImpressionTimer() {
			if ( impressionSent || ! analyticsReady ) return;
			if ( impressionVisible && document.visibilityState !== 'hidden' ) {
				if ( ! impressionTimer ) impressionTimer = window.setTimeout( function() { impressionTimer = null; if ( impressionVisible && document.visibilityState !== 'hidden' ) recordImpression(); }, 1000 );
			} else if ( impressionTimer ) {
				window.clearTimeout( impressionTimer ); impressionTimer = null;
			}
		}
		function readerIsVisible() { return document.visibilityState !== 'hidden' && ( readerIntersecting || isRootFullscreen() || ( modal && ! modal.hidden ) ); }
		function markReaderActivity() { if ( readingStarted ) { lastReaderActivity = Date.now(); rememberSession( false ); } }
		function flushActiveTime() {
			if ( ! readingStarted || activeSecondsSent >= 1800 ) return;
			const seconds = Math.min( 15, 1800 - activeSecondsSent, Math.floor( activeMilliseconds / 1000 ) );
			if ( seconds < 1 ) return;
			activeMilliseconds -= seconds * 1000; activeSecondsSent += seconds;
			emitReaderEvent( 'active_time', Object.assign( { mode: activeMode, readingStarted: true, activeSecondsDelta: seconds }, pageData( readingPageIndex() ) ) );
			rememberSession( true );
			if ( activeSecondsSent >= 1800 && activeTimer ) { window.clearInterval( activeTimer ); activeTimer = null; }
		}
		function activeTick() {
			const now = Date.now(), elapsed = Math.min( 2000, Math.max( 0, now - lastActiveTick ) ); lastActiveTick = now;
			if ( readingStarted && activeSecondsSent < 1800 && readerIsVisible() && now - lastReaderActivity <= 90000 ) activeMilliseconds += elapsed;
			if ( activeMilliseconds >= 15000 ) flushActiveTime();
		}
		function startActiveTimer() { if ( activeTimer ) return; lastActiveTick = Date.now(); activeTimer = window.setInterval( activeTick, 1000 ); }
		if ( typeof window.IntersectionObserver === 'function' ) new window.IntersectionObserver( function( entries ) { if ( entries[ 0 ] ) { readerIntersecting = entries[ 0 ].isIntersecting && entries[ 0 ].intersectionRatio >= .1; impressionVisible = entries[ 0 ].isIntersecting && entries[ 0 ].intersectionRatio >= .5; updateImpressionTimer(); } }, { threshold: [ 0, .1, .5 ] } ).observe( root );
		[ 'pointerdown', 'keydown', 'touchstart', 'wheel', 'click' ].forEach( function( type ) { root.addEventListener( type, markReaderActivity, { passive: true } ); } );
		document.addEventListener( 'visibilitychange', function() { if ( document.visibilityState === 'hidden' ) flushActiveTime(); else lastActiveTick = Date.now(); updateImpressionTimer(); } );
		window.addEventListener( 'pagehide', function() { activeTick(); flushActiveTime(); rememberSession( true ); } );
		function reachPage( index, mode ) { if ( ! analyticsReady || ! pages[ index ] ) return; const data = pageData( index ); if ( reachedPages[ data.pageKey ] ) return; reachedPages[ data.pageKey ] = true; emitReaderEvent( 'page_reach', Object.assign( { mode: mode || activeMode }, data ) ); }
		function useMode( mode ) { activeMode = mode; if ( ! analyticsReady ) return; recordImpression(); if ( ! readingStarted ) { readingSessionId = resumableSessionId() || runtimeId( 'session' ); readingStarted = true; lastReaderActivity = Date.now(); startActiveTimer(); rememberSession( true ); emitReaderEvent( 'read_start', Object.assign( { mode: mode }, pageData( readingPageIndex() ) ) ); } else markReaderActivity(); if ( ! usedModes[ mode ] ) { usedModes[ mode ] = true; emitReaderEvent( 'mode_use', Object.assign( { mode: mode }, pageData( readingPageIndex() ) ) ); } reachVisiblePages( mode ); }
		function recordCtaClick( cta, pageIndex ) { if ( ! cta || ! keyPattern.test( cta.dataset.ctaKey || '' ) ) return; recordImpression(); emitReaderEvent( 'cta_click', Object.assign( { mode: readingStarted ? activeMode : 'standard_direct', ctaKey: cta.dataset.ctaKey, readingStarted: readingStarted }, pageData( Number.isInteger( pageIndex ) ? pageIndex : current ) ) ); }
		root.addEventListener( 'click', function( event ) { const cta = event.target && event.target.closest ? event.target.closest( '.amv-reader__cta' ) : null; if ( ! cta || ! root.contains( cta ) ) return; const page = cta.closest( '.amv-reader__page' ); recordCtaClick( cta, page ? Number( page.dataset.pageIndex ) : readingPageIndex() ); } );
		function isRootFullscreen() { return document.fullscreenElement === root; }
		function exitRootFullscreen() { const request = document.exitFullscreen(); if ( request && typeof request.catch === 'function' ) request.catch( function() {} ); }
		function activeCanvas() { return surface; }
		function zoomLimits() { const canvas = activeCanvas(), viewport = root.querySelector( '.amv-reader__pages' ); if ( ! canvas || ! viewport ) return { x: 0, y: 0 }; if ( pageFocusVisible() ) return { x: Math.max( 0, viewport.clientWidth * ( zoomScale - 1 ) / 2 ), y: Math.max( 0, viewport.clientHeight * ( zoomScale - 1 ) / 2 ) }; return { x: Math.max( 0, ( canvas.clientWidth * zoomScale - viewport.clientWidth ) / 2 ), y: Math.max( 0, ( canvas.clientHeight * zoomScale - viewport.clientHeight ) / 2 ) }; }
		function applyZoom() {
			if ( ! zoomEnabled ) return;
			const canvas = activeCanvas(); if ( ! canvas ) return;
			const limits = zoomLimits(); panX = clamp( panX, -limits.x, limits.x ); panY = clamp( panY, -limits.y, limits.y );
			canvas.style.transform = zoomScale === 1 ? '' : 'translate(' + panX + 'px,' + panY + 'px) scale(' + zoomScale + ')';
			root.classList.toggle( 'is-zoomed', zoomScale > 1 ); zoomLevel.textContent = Math.round( zoomScale * 100 ) + '%'; zoomOut.disabled = zoomScale <= 1; zoomIn.disabled = zoomScale >= 3; zoomReset.disabled = zoomScale <= 1;
			updateButtons();
		}
		function setZoom( value ) { if ( ! zoomEnabled ) return; const previousScale = zoomScale; zoomScale = clamp( Math.round( value * 100 ) / 100, 1, 3 ); if ( zoomScale === 1 ) { panX = 0; panY = 0; } applyZoom(); if ( previousScale <= 1 && zoomScale > 1 ) useMode( 'zoom' ); else if ( previousScale > 1 && zoomScale === 1 ) activeMode = isRootFullscreen() ? 'fullscreen' : 'standard'; }
		function resetZoom() { if ( ! zoomEnabled ) return; const canvas = activeCanvas(); if ( canvas ) canvas.style.transform = ''; zoomScale = 1; panX = 0; panY = 0; root.classList.remove( 'is-zoomed', 'is-panning' ); zoomLevel.textContent = '100%'; zoomOut.disabled = true; zoomIn.disabled = false; zoomReset.disabled = true; updateButtons(); }
		function panBy( dx, dy ) { if ( zoomScale <= 1 ) return; panX += dx; panY += dy; applyZoom(); }
		function updateButtons() { const zoomed = zoomScale > 1; const pageNavigation = usesPageFocusNavigation(); const atEnd = pageNavigation ? focusedPageIndex === pages.length - 1 : currentView === views.length - 1; const atStart = pageNavigation ? focusedPageIndex === 0 : currentView === 0; const nextExitsFullscreen = atEnd && isRootFullscreen() && ! zoomed; const zoomNextExitsFullscreen = atEnd && isRootFullscreen() && zoomed; root.classList.toggle( 'is-first-page', atStart ); Array.prototype.forEach.call( buttons.previous, function( button ) { button.disabled = zoomed || atStart; } ); Array.prototype.forEach.call( buttons.next, function( button ) { button.disabled = zoomed || ( atEnd && ! nextExitsFullscreen ); button.setAttribute( 'aria-label', nextExitsFullscreen ? '全画面を終了' : '次のページ' ); } ); if ( zoomPagePrevious ) zoomPagePrevious.disabled = atStart; if ( zoomPageNext ) { zoomPageNext.disabled = atEnd && ! zoomNextExitsFullscreen; zoomPageNext.setAttribute( 'aria-label', zoomNextExitsFullscreen ? 'ズームを解除して全画面を終了' : 'ズームを解除して次のページ' ); } const active = activePageIndexes(); const focusedOnly = pageFocusVisible(); if ( count ) count.textContent = focusedOnly ? ( focusedPageIndex + 1 ) + ' / ' + pages.length : ( active.length === 2 ? ( active[ 0 ] + 1 ) + '–' + ( active[ 1 ] + 1 ) + ' / ' + pages.length : ( active[ 0 ] + 1 ) + ' / ' + pages.length ); stage.setAttribute( 'aria-label', focusedOnly ? ( focusedPageIndex + 1 ) + 'ページ目を拡大表示中。左右キーまたはスワイプで送れます' : ( active.length === 2 ? ( active[ 0 ] + 1 ) + 'ページ目と' + ( active[ 1 ] + 1 ) + 'ページ目を表示中。左右キーまたはスワイプで送れます' : ( active[ 0 ] + 1 ) + 'ページ目を表示中。左右キーまたはスワイプで送れます' ) ); }
		function finalPageIsVisible() { return activePageIndexes().indexOf( pages.length - 1 ) !== -1; }
		function returnToFirstPage() { resetZoom(); temporaryOverview = false; activateView( viewForPage( 0 ), 0 ); updateButtons(); activeMode = 'standard'; }
		function finishViewChange( nextView, readingMode ) { activateView( nextView ); locked = false; updateButtons(); reachVisiblePages( readingMode ); activeMode = isRootFullscreen() ? 'fullscreen' : 'standard'; }
		function change( nextView ) {
			nextView = clamp( nextView, 0, views.length - 1 ); if ( nextView === currentView || locked || zoomScale > 1 ) return;
			const readingMode = isRootFullscreen() ? 'fullscreen' : ( activeMode === 'zoom' ? 'zoom' : 'standard' ); useMode( readingMode ); resetZoom();
			if ( spreadActive ) { locked = true; finishViewChange( nextView, readingMode ); return; }
			const direction = nextView > currentView ? 'next' : 'previous'; const oldPage = pages[ current ], newPage = pages[ views[ nextView ][ 0 ] ]; locked = true; newPage.classList.add( 'is-active', 'is-under' ); oldPage.classList.add( 'is-leaving', 'is-leaving-' + direction ); root.classList.add( 'is-turning' );
			window.setTimeout( function() { root.classList.remove( 'is-turning' ); finishViewChange( nextView, readingMode ); }, root.dataset.animation === 'off' ? 0 : duration );
		}
		function moveFocusedPage( offset ) { const target = clamp( focusedPageIndex + offset, 0, pages.length - 1 ); if ( target === focusedPageIndex || locked || zoomScale > 1 ) return; const readingMode = isRootFullscreen() ? 'fullscreen' : ( activeMode === 'zoom' ? 'zoom' : 'standard' ); const targetView = viewForPage( target ); useMode( readingMode ); resetZoom(); temporaryOverview = false; locked = true; if ( targetView !== currentView ) root.classList.add( 'is-focus-surface-changing' ); activateView( targetView, target ); locked = false; updateButtons(); reachVisiblePages( readingMode ); activeMode = isRootFullscreen() ? 'fullscreen' : 'standard'; window.setTimeout( function() { root.classList.remove( 'is-focus-surface-changing' ); }, 220 ); }
		function previous() { if ( zoomScale > 1 ) return; if ( usesPageFocusNavigation() ) { moveFocusedPage( -1 ); return; } change( currentView - 1 ); } function next() { if ( zoomScale > 1 ) return; const atEnd = usesPageFocusNavigation() ? focusedPageIndex === pages.length - 1 : currentView === views.length - 1; if ( atEnd && isRootFullscreen() ) { exitRootFullscreen(); return; } if ( usesPageFocusNavigation() ) { moveFocusedPage( 1 ); return; } change( currentView + 1 ); }
		Array.prototype.forEach.call( buttons.previous, function( button ) { button.addEventListener( 'click', previous ); } ); Array.prototype.forEach.call( buttons.next, function( button ) { button.addEventListener( 'click', next ); } );
		stage.addEventListener( 'keydown', function( event ) {
			if ( zoomEnabled && ( event.key === '+' || event.key === '=' ) ) { event.preventDefault(); setZoom( zoomScale + .25 ); return; }
			if ( zoomEnabled && ( event.key === '-' || event.key === '_' ) ) { event.preventDefault(); setZoom( zoomScale - .25 ); return; }
			if ( zoomEnabled && event.key === '0' ) { event.preventDefault(); resetZoom(); activeMode = isRootFullscreen() ? 'fullscreen' : 'standard'; return; }
			if ( zoomScale > 1 && [ 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown' ].indexOf( event.key ) !== -1 ) { event.preventDefault(); panBy( event.key === 'ArrowLeft' ? 40 : ( event.key === 'ArrowRight' ? -40 : 0 ), event.key === 'ArrowUp' ? 40 : ( event.key === 'ArrowDown' ? -40 : 0 ) ); return; }
			if ( event.key === 'ArrowLeft' ) { event.preventDefault(); binding === 'rtl' ? next() : previous(); } if ( event.key === 'ArrowRight' ) { event.preventDefault(); binding === 'rtl' ? previous() : next(); }
		} );
		bindSwipe( stage, 40, function( dx ) { if ( zoomScale > 1 ) return; ( binding === 'rtl' ? dx > 0 : dx < 0 ) ? next() : previous(); } );
		if ( zoomEnabled ) {
			zoomOut.addEventListener( 'click', function() { setZoom( zoomScale - .25 ); } ); zoomIn.addEventListener( 'click', function() { setZoom( zoomScale + .25 ); } ); zoomReset.addEventListener( 'click', function() { resetZoom(); activeMode = isRootFullscreen() ? 'fullscreen' : 'standard'; } );
			if ( zoomPagePrevious ) zoomPagePrevious.addEventListener( 'click', function() { if ( zoomScale <= 1 ) return; resetZoom(); previous(); } );
			if ( zoomPageNext ) zoomPageNext.addEventListener( 'click', function() { if ( zoomScale <= 1 ) return; resetZoom(); next(); } );
			stage.addEventListener( 'pointerdown', function( event ) { if ( zoomScale <= 1 || event.pointerType === 'touch' || event.button !== 0 || ( event.target.closest && event.target.closest( '.amv-reader__cta, .amv-reader__zoom-controls' ) ) ) return; event.preventDefault(); panPointer = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: panX, panY: panY }; root.classList.add( 'is-panning' ); stage.setPointerCapture && stage.setPointerCapture( event.pointerId ); } );
			stage.addEventListener( 'pointermove', function( event ) { if ( ! panPointer || panPointer.id !== event.pointerId ) return; event.preventDefault(); panX = panPointer.panX + event.clientX - panPointer.x; panY = panPointer.panY + event.clientY - panPointer.y; applyZoom(); } );
			function endPointer( event ) { if ( ! panPointer || panPointer.id !== event.pointerId ) return; panPointer = null; root.classList.remove( 'is-panning' ); if ( stage.hasPointerCapture && stage.hasPointerCapture( event.pointerId ) ) stage.releasePointerCapture( event.pointerId ); }
			stage.addEventListener( 'pointerup', endPointer ); stage.addEventListener( 'pointercancel', endPointer );
			stage.addEventListener( 'touchstart', function( event ) { if ( event.target.closest && event.target.closest( '.amv-reader__cta, .amv-reader__zoom-controls' ) ) return; if ( event.touches.length === 2 ) { const dx = event.touches[ 1 ].clientX - event.touches[ 0 ].clientX, dy = event.touches[ 1 ].clientY - event.touches[ 0 ].clientY; pinch = { distance: Math.hypot( dx, dy ) || 1, scale: zoomScale }; touchPan = null; event.preventDefault(); } else if ( event.touches.length === 1 && zoomScale > 1 ) { touchPan = { id: event.touches[ 0 ].identifier, x: event.touches[ 0 ].clientX, y: event.touches[ 0 ].clientY, panX: panX, panY: panY }; root.classList.add( 'is-panning' ); event.preventDefault(); } }, { passive: false } );
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
		const fullscreen = root.querySelector( '.amv-reader__fullscreen' );
		if ( fullscreen ) {
			function restoreFullscreenScrollPosition() { if ( fullscreenReturnViewportTop === null ) return; const targetViewportTop = fullscreenReturnViewportTop; fullscreenReturnViewportTop = null; assisting = true; window.requestAnimationFrame( function() { window.requestAnimationFrame( function() { const top = Math.max( 0, window.scrollY + root.getBoundingClientRect().top - targetViewportTop ); window.scrollTo( 0, top ); window.setTimeout( function() { assisting = false; }, 260 ); } ); } ); }
			function updateFullscreen() { const wasActive = root.classList.contains( 'is-fullscreen' ); const active = isRootFullscreen(); const completed = wasActive && ! active && finalPageIsVisible(); root.classList.toggle( 'is-fullscreen', active ); fullscreen.setAttribute( 'aria-pressed', active ? 'true' : 'false' ); fullscreen.textContent = active ? '全画面を終了' : '全画面で読む'; if ( ! active ) { if ( completed ) returnToFirstPage(); else { resetZoom(); activeMode = 'standard'; } if ( wasActive ) restoreFullscreenScrollPosition(); } else { updateButtons(); useMode( 'fullscreen' ); } window.requestAnimationFrame( function() { updateFullscreenSpreadSizing(); applyPageFocus(); } ); if ( active ) stage.focus(); }
			if ( typeof root.requestFullscreen !== 'function' || typeof document.exitFullscreen !== 'function' ) fullscreen.hidden = true;
			else { fullscreen.addEventListener( 'click', function() { if ( document.fullscreenElement !== root ) fullscreenReturnViewportTop = root.getBoundingClientRect().top; const request = document.fullscreenElement === root ? document.exitFullscreen() : root.requestFullscreen(); if ( request && typeof request.catch === 'function' ) request.catch( function() {} ); } ); document.addEventListener( 'fullscreenchange', updateFullscreen ); updateFullscreen(); }
		}

		if ( ! openFocus || ! modal ) return;
		[ 'pointerdown', 'keydown', 'touchstart', 'wheel', 'click' ].forEach( function( type ) { modal.addEventListener( type, markReaderActivity, { passive: true } ); } );
		const modalStage = modal.querySelector( '.amv-modal__stage' ); const modalImage = modal.querySelector( '.amv-modal__image' ); const modalCtaLayer = modal.querySelector( '.amv-modal__cta-layer' ); const modalCount = modal.querySelector( '.amv-modal__count' ); const close = modal.querySelector( '.amv-modal__close' ); const modalPrevious = modal.querySelector( '.amv-modal__previous' ); const modalNext = modal.querySelector( '.amv-modal__next' ); const modalPreviousEdge = modal.querySelector( '.amv-modal__edge--previous' ); const modalNextEdge = modal.querySelector( '.amv-modal__edge--next' ); const overview = modal.querySelector( '.amv-modal__overview' );
		modal.dataset.binding = binding;
		let sequence = [], focusIndex = 0, restoreFocus = null, showingOverview = false;
		function rebuildSequence() { const useMobileAreas = root.dataset.mobileFocusReader === 'on' && window.matchMedia( '(max-width: 781px)' ).matches; sequence = []; pages.forEach( function( page, pageIndex ) { const areas = parseAreas( page, useMobileAreas ); if ( areas.length ) areas.forEach( function( area, areaIndex ) { sequence.push( { pageIndex: pageIndex, areaIndex: areaIndex, area: area } ); } ); else sequence.push( { pageIndex: pageIndex, areaIndex: -1, area: { x: 50, y: 50, width: 100, height: 100, view: 'overview' } } ); } ); }
		function focusForPage() { const exact = sequence.findIndex( function( item ) { return item.pageIndex === current; } ); return exact === -1 ? 0 : exact; }
		function updateModalCta( page, pageIndex, x, y, width, height ) {
			if ( ! modalCtaLayer ) return;
			modalCtaLayer.style.left = x + 'px'; modalCtaLayer.style.top = y + 'px'; modalCtaLayer.style.width = width + 'px'; modalCtaLayer.style.height = height + 'px';
			if ( Number( modalCtaLayer.dataset.pageIndex ) === pageIndex ) return;
			modalCtaLayer.dataset.pageIndex = String( pageIndex ); modalCtaLayer.textContent = '';
			const sourceCta = page.querySelector( '.amv-reader__cta' );
			if ( ! sourceCta ) { modalCtaLayer.hidden = true; return; }
			const cta = sourceCta.cloneNode( true ); cta.classList.add( 'amv-modal__cta' );
			cta.addEventListener( 'click', function( event ) { event.stopPropagation(); markReaderActivity(); recordCtaClick( cta, pageIndex ); } );
			modalCtaLayer.appendChild( cta ); modalCtaLayer.hidden = false;
		}
		function fitFocus() {
			const item = sequence[ focusIndex ]; if ( ! item ) return;
			const page = pages[ item.pageIndex ]; const source = page.querySelector( 'img' ); if ( ! source ) return;
			const sourceUrl = page.dataset.viewerSrc || source.currentSrc || source.src;
			if ( modalImage.dataset.source !== sourceUrl ) {
				modalImage.dataset.source = sourceUrl; modalImage.alt = source.alt || '';
				modalImage.onload = function() { if ( modalImage.dataset.source === sourceUrl ) fitFocus(); };
				modalImage.src = sourceUrl;
				return;
			}
			const naturalWidth = source.naturalWidth || modalImage.naturalWidth || 1, naturalHeight = source.naturalHeight || modalImage.naturalHeight || 1, rect = modalStage.getBoundingClientRect();
			const autoOverview = item.area.view === 'auto' && ( item.area.width >= 74 || item.area.height >= 68 );
			const useOverview = showingOverview || item.area.view === 'overview' || autoOverview;
			const containScale = Math.min( rect.width / ( naturalWidth * item.area.width / 100 ), rect.height / ( naturalHeight * item.area.height / 100 ) ); const deviceScale = window.matchMedia( '(max-width: 781px)' ).matches ? .92 : .86; const zoom = clamp( Number( item.area.zoom ) || 100, 60, 110 ) / 100; const focusScale = containScale * deviceScale * zoom; const scale = useOverview ? Math.min( rect.width / naturalWidth, rect.height / naturalHeight ) : focusScale;
			const width = naturalWidth * scale, height = naturalHeight * scale, x = useOverview ? ( rect.width - width ) / 2 : rect.width / 2 - width * item.area.x / 100, y = useOverview ? ( rect.height - height ) / 2 : rect.height / 2 - height * item.area.y / 100;
			modalImage.style.width = width + 'px'; modalImage.style.height = height + 'px'; modalImage.style.left = x + 'px'; modalImage.style.top = y + 'px'; updateModalCta( page, item.pageIndex, x, y, width, height );
			const isFirstFocus = focusIndex === 0, isLastFocus = focusIndex === sequence.length - 1; modalCount.textContent = ( focusIndex + 1 ) + ' / ' + sequence.length; overview.textContent = useOverview ? 'コマへ戻る' : 'ページ全体'; modalPrevious.disabled = false; modalPrevious.textContent = isFirstFocus ? 'ビューアーを閉じる' : '前のコマ'; modalPrevious.setAttribute( 'aria-label', isFirstFocus ? 'ビューアーを閉じる' : '前のコマ' ); modalNext.disabled = false; modalNext.textContent = isLastFocus ? 'ビューアーを閉じる' : '次のコマ'; modalNext.setAttribute( 'aria-label', isLastFocus ? 'ビューアーを閉じる' : '次のコマ' );
		}
		function syncPage( pageIndex ) { const targetView = viewForPage( pageIndex ); const changed = targetView !== currentView || focusedPageIndex !== pageIndex; if ( ! changed ) return false; resetZoom(); temporaryOverview = false; activateView( targetView, pageIndex ); updateButtons(); return true; }
		function playFocusPageTurn( direction ) {
			if ( ! modalImage.src || ! modalImage.style.width || ! modalImage.style.height ) return;
			const sheet = document.createElement( 'div' ); const image = document.createElement( 'img' ); let removed = false;
			sheet.className = 'amv-modal__turning-sheet is-turning-' + direction;
			sheet.style.left = modalImage.style.left; sheet.style.top = modalImage.style.top; sheet.style.width = modalImage.style.width; sheet.style.height = modalImage.style.height;
			image.src = modalImage.currentSrc || modalImage.src; image.alt = ''; image.setAttribute( 'aria-hidden', 'true' ); sheet.appendChild( image ); modalStage.appendChild( sheet );
			function removeSheet() { if ( removed ) return; removed = true; sheet.remove(); }
			sheet.addEventListener( 'animationend', removeSheet, { once: true } );
			window.requestAnimationFrame( function() { sheet.classList.add( 'is-turning' ); } );
			window.setTimeout( removeSheet, 440 );
		}
		function setFocus( nextIndex ) { const previousPage = sequence[ focusIndex ] ? sequence[ focusIndex ].pageIndex : current; const targetIndex = clamp( nextIndex, 0, sequence.length - 1 ); const target = sequence[ targetIndex ]; const pageChanged = target && target.pageIndex !== previousPage; if ( pageChanged ) playFocusPageTurn( target.pageIndex > previousPage ? 'next' : 'previous' ); focusIndex = targetIndex; showingOverview = false; if ( target ) { syncPage( target.pageIndex ); useMode( 'focus' ); reachPage( target.pageIndex, 'focus' ); } fitFocus(); }
		const modalParent = modal.parentNode; const modalNextSibling = modal.nextSibling;
		function openModal() { rebuildSequence(); if ( ! sequence.length ) return; restoreFocus = document.activeElement; if ( document.fullscreenElement !== root && modal.parentNode !== document.body ) document.body.appendChild( modal ); focusIndex = root.dataset.focusStart === 'current' ? focusForPage() : 0; syncPage( sequence[ focusIndex ].pageIndex ); useMode( 'focus' ); reachPage( sequence[ focusIndex ].pageIndex, 'focus' ); modal.hidden = false; document.body.classList.add( 'amv-modal-open' ); fitFocus(); close.focus(); }
		function closeModal() { const completed = !! sequence[ focusIndex ] && sequence[ focusIndex ].pageIndex === pages.length - 1; modal.hidden = true; document.body.classList.remove( 'amv-modal-open' ); activeMode = isRootFullscreen() ? 'fullscreen' : 'standard'; if ( modal.parentNode === document.body ) modalParent.insertBefore( modal, modalNextSibling ); if ( completed ) returnToFirstPage(); if ( restoreFocus && restoreFocus.focus ) restoreFocus.focus(); }
		openFocus.addEventListener( 'click', openModal ); close.addEventListener( 'click', closeModal ); modalPrevious.addEventListener( 'click', function() { if ( focusIndex === 0 ) closeModal(); else setFocus( focusIndex - 1 ); } ); modalNext.addEventListener( 'click', function() { if ( focusIndex === sequence.length - 1 ) closeModal(); else setFocus( focusIndex + 1 ); } ); modalPreviousEdge.addEventListener( 'click', function() { setFocus( focusIndex - 1 ); } ); modalNextEdge.addEventListener( 'click', function() { setFocus( focusIndex + 1 ); } ); overview.addEventListener( 'click', function() { showingOverview = ! showingOverview; fitFocus(); } );
		modal.addEventListener( 'keydown', function( event ) {
			if ( event.key === 'Tab' ) {
				const focusable = Array.from( modal.querySelectorAll( 'button:not(:disabled), a[href]' ) ).filter( function( control ) { return control.getClientRects().length > 0; } );
				const first = focusable[ 0 ], last = focusable[ focusable.length - 1 ];
				if ( event.shiftKey && document.activeElement === first ) { event.preventDefault(); last.focus(); }
				else if ( ! event.shiftKey && document.activeElement === last ) { event.preventDefault(); first.focus(); }
			}
			if ( event.key === 'Escape' ) { event.preventDefault(); closeModal(); }
			if ( event.key === 'ArrowLeft' ) { event.preventDefault(); setFocus( focusIndex + ( binding === 'rtl' ? 1 : -1 ) ); }
			if ( event.key === 'ArrowRight' ) { event.preventDefault(); setFocus( focusIndex - ( binding === 'rtl' ? 1 : -1 ) ); }
		} );
		bindSwipe( modalStage, 36, function( dx ) { setFocus( focusIndex + ( ( binding === 'rtl' ? dx > 0 : dx < 0 ) ? 1 : -1 ) ); } );
		window.addEventListener( 'resize', function() { if ( ! modal.hidden ) fitFocus(); } );
	}
	document.querySelectorAll( '.wp-block-ai-manga-viewer-viewer' ).forEach( init );
	const analyticsConfig = window.aiMangaViewerAnalytics;
	if ( analyticsConfig && typeof analyticsConfig.restUrl === 'string' && analyticsConfig.restUrl && typeof window.fetch === 'function' ) {
		const pending = {};
		const queued = [];
		const dynamicConfigUrl = typeof analyticsConfig.configUrl === 'string' && analyticsConfig.configUrl ? analyticsConfig.configUrl : analyticsConfig.restUrl.replace( /\/events(?:\?.*)?$/, '/config' );
		let configResolved = ! dynamicConfigUrl && typeof analyticsConfig.enabled === 'boolean';
		let transportEnabled = true === analyticsConfig.enabled;
		function deliver( detail, attempt ) {
			pending[ detail.eventId ] = detail;
			window.fetch( analyticsConfig.restUrl, { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify( detail ) } ).then( function( response ) {
				if ( ! response.ok ) throw new Error( 'Analytics request failed' );
				delete pending[ detail.eventId ];
			} ).catch( function() {
				if ( attempt < 2 ) window.setTimeout( function() { deliver( detail, attempt + 1 ); }, 500 * ( attempt + 1 ) );
			} );
		}
		function resolveConfig( enabled ) { configResolved = true; transportEnabled = true === enabled; analyticsConfig.enabled = transportEnabled; if ( transportEnabled ) queued.splice( 0 ).forEach( function( detail ) { deliver( detail, 0 ); } ); else queued.length = 0; }
		document.addEventListener( 'amv:reader-event', function( event ) { if ( ! event.detail || ! event.detail.eventId ) return; if ( ! configResolved ) queued.push( event.detail ); else if ( transportEnabled ) deliver( event.detail, 0 ); } );
		if ( ! configResolved && dynamicConfigUrl ) {
			window.fetch( dynamicConfigUrl, { method: 'GET', credentials: 'same-origin', cache: 'no-store', headers: { 'Accept': 'application/json' } } ).then( function( response ) { if ( ! response.ok ) throw new Error( 'Analytics config request failed' ); return response.json(); } ).then( function( config ) { resolveConfig( config && config.enabled ); } ).catch( function() { resolveConfig( false ); } );
		} else if ( ! configResolved ) resolveConfig( false );
		window.addEventListener( 'pagehide', function() {
			if ( ! navigator.sendBeacon ) return;
			Object.keys( pending ).forEach( function( eventId ) { navigator.sendBeacon( analyticsConfig.restUrl, new Blob( [ JSON.stringify( pending[ eventId ] ) ], { type: 'application/json' } ) ); } );
		} );
	}
} )();
