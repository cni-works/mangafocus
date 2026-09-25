( function() {
	'use strict';
	const duration = 360;
	function clamp( value, min, max ) { return Math.max( min, Math.min( max, value ) ); }
	function parseAreas( page, mobile ) { try { const value = JSON.parse( mobile ? ( page.dataset.mobileFocusAreas || '[]' ) : ( page.dataset.focusAreas || '[]' ) ); return Array.isArray( value ) ? value : []; } catch ( error ) { return []; } }
	function init( root ) {
		const stage = root.querySelector( '.amv-reader__stage' );
		const pages = Array.prototype.slice.call( root.querySelectorAll( '.amv-reader__page' ) );
		if ( ! stage || ! pages.length ) return;
		const binding = root.dataset.binding === 'ltr' ? 'ltr' : 'rtl';
		const buttons = { previous: root.querySelectorAll( '.amv-reader__button--previous, .amv-reader__edge--previous' ), next: root.querySelectorAll( '.amv-reader__button--next, .amv-reader__edge--next' ) };
		const count = root.querySelector( '.amv-reader__count' );
		let current = 0, touchStartX = null, locked = false, scrollTimer = null, assisting = false;
		root.classList.add( 'is-enhanced' );
		function updateButtons() { root.classList.toggle( 'is-first-page', current === 0 ); Array.prototype.forEach.call( buttons.previous, function( button ) { button.disabled = current === 0; } ); Array.prototype.forEach.call( buttons.next, function( button ) { button.disabled = current === pages.length - 1; } ); if ( count ) count.textContent = ( current + 1 ) + ' / ' + pages.length; }
		function change( next ) { next = clamp( next, 0, pages.length - 1 ); if ( next === current || locked ) return; const direction = next > current ? 'next' : 'previous'; const oldPage = pages[ current ], newPage = pages[ next ]; locked = true; newPage.classList.add( 'is-active', 'is-under' ); oldPage.classList.add( 'is-leaving', 'is-leaving-' + direction ); root.classList.add( 'is-turning' ); window.setTimeout( function() { oldPage.classList.remove( 'is-active', 'is-leaving', 'is-leaving-next', 'is-leaving-previous' ); newPage.classList.remove( 'is-under' ); root.classList.remove( 'is-turning' ); current = next; locked = false; updateButtons(); }, root.dataset.animation === 'off' ? 0 : duration ); }
		function previous() { change( current - 1 ); } function next() { change( current + 1 ); }
		Array.prototype.forEach.call( buttons.previous, function( button ) { button.addEventListener( 'click', previous ); } ); Array.prototype.forEach.call( buttons.next, function( button ) { button.addEventListener( 'click', next ); } );
		stage.addEventListener( 'keydown', function( event ) { if ( event.key === 'ArrowLeft' ) { event.preventDefault(); binding === 'rtl' ? next() : previous(); } if ( event.key === 'ArrowRight' ) { event.preventDefault(); binding === 'rtl' ? previous() : next(); } } );
		stage.addEventListener( 'touchstart', function( event ) { touchStartX = event.changedTouches[ 0 ].clientX; }, { passive: true } );
		stage.addEventListener( 'touchend', function( event ) { if ( touchStartX === null ) return; const delta = event.changedTouches[ 0 ].clientX - touchStartX; touchStartX = null; if ( Math.abs( delta ) < 40 ) return; delta < 0 ? next() : previous(); }, { passive: true } );
		if ( root.dataset.scrollAssist === 'on' && ! window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ) window.addEventListener( 'scroll', function() { if ( assisting ) return; window.clearTimeout( scrollTimer ); scrollTimer = window.setTimeout( function() { const rect = stage.getBoundingClientRect(), viewportHeight = window.innerHeight || document.documentElement.clientHeight, visible = Math.min( rect.bottom, viewportHeight ) - Math.max( rect.top, 0 ); if ( visible < Math.min( 160, Math.min( rect.height, viewportHeight ) * .28 ) ) return; const position = [ 'auto', 'top', 'center' ].indexOf( root.dataset.scrollPosition ) !== -1 ? root.dataset.scrollPosition : 'auto', strength = [ 'gentle', 'normal', 'strong' ].indexOf( root.dataset.scrollStrength ) !== -1 ? root.dataset.scrollStrength : 'normal', values = { gentle: { threshold: 150, amount: .45 }, normal: { threshold: 300, amount: .72 }, strong: { threshold: 520, amount: 1 } }[ strength ], centeredTarget = Math.max( 24, ( viewportHeight - rect.height ) / 2 ), target = position === 'top' ? 24 : ( position === 'center' ? centeredTarget : ( rect.height <= viewportHeight * .84 ? centeredTarget : 24 ) ), offset = rect.top - target; if ( Math.abs( offset ) < 8 || Math.abs( offset ) > values.threshold ) return; assisting = true; window.scrollTo( { top: Math.max( 0, window.scrollY + offset * values.amount ), behavior: 'smooth' } ); window.setTimeout( function() { assisting = false; }, 500 ); }, 160 ); }, { passive: true } );
		updateButtons();

		const openFocus = root.querySelector( '.amv-reader__focus-open' ); const modal = root.querySelector( '.amv-modal' );
		if ( ! openFocus || ! modal ) return;
		const modalStage = modal.querySelector( '.amv-modal__stage' ); const modalImage = modal.querySelector( '.amv-modal__image' ); const modalCount = modal.querySelector( '.amv-modal__count' ); const close = modal.querySelector( '.amv-modal__close' ); const modalPrevious = modal.querySelector( '.amv-modal__previous' ); const modalNext = modal.querySelector( '.amv-modal__next' ); const modalPreviousEdge = modal.querySelector( '.amv-modal__edge--previous' ); const modalNextEdge = modal.querySelector( '.amv-modal__edge--next' ); const overview = modal.querySelector( '.amv-modal__overview' );
		let sequence = [], focusIndex = 0, focusTouchX = null, restoreFocus = null, showingOverview = false;
		function rebuildSequence() { const useMobileAreas = root.dataset.mobileFocusReader === 'on' && window.matchMedia( '(max-width: 781px)' ).matches; sequence = []; pages.forEach( function( page, pageIndex ) { const areas = parseAreas( page, useMobileAreas ); if ( areas.length ) areas.forEach( function( area, areaIndex ) { sequence.push( { pageIndex: pageIndex, areaIndex: areaIndex, area: area } ); } ); else sequence.push( { pageIndex: pageIndex, areaIndex: -1, area: { x: 50, y: 50, width: 100, height: 100, view: 'overview' } } ); } ); }
		function focusForPage() { const exact = sequence.findIndex( function( item ) { return item.pageIndex === current; } ); return exact === -1 ? 0 : exact; }
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
			modalImage.style.width = width + 'px'; modalImage.style.height = height + 'px'; modalImage.style.left = x + 'px'; modalImage.style.top = y + 'px';
			const isFirstFocus = focusIndex === 0, isLastFocus = focusIndex === sequence.length - 1; modalCount.textContent = ( focusIndex + 1 ) + ' / ' + sequence.length; overview.textContent = useOverview ? 'コマへ戻る' : 'ページ全体'; modalPrevious.disabled = false; modalPrevious.textContent = isFirstFocus ? 'ビューアーを閉じる' : '前のコマ'; modalPrevious.setAttribute( 'aria-label', isFirstFocus ? 'ビューアーを閉じる' : '前のコマ' ); modalNext.disabled = false; modalNext.textContent = isLastFocus ? 'ビューアーを閉じる' : '次のコマ'; modalNext.setAttribute( 'aria-label', isLastFocus ? 'ビューアーを閉じる' : '次のコマ' );
		}
		function syncPage( pageIndex ) { if ( pageIndex === current ) return false; pages.forEach( function( page, index ) { page.classList.toggle( 'is-active', index === pageIndex ); page.classList.remove( 'is-under', 'is-leaving', 'is-leaving-next', 'is-leaving-previous' ); } ); current = pageIndex; updateButtons(); return true; }
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
		function setFocus( nextIndex ) { const previousPage = sequence[ focusIndex ] ? sequence[ focusIndex ].pageIndex : current; const targetIndex = clamp( nextIndex, 0, sequence.length - 1 ); const target = sequence[ targetIndex ]; const pageChanged = target && target.pageIndex !== previousPage; if ( pageChanged ) playFocusPageTurn( target.pageIndex > previousPage ? 'next' : 'previous' ); focusIndex = targetIndex; showingOverview = false; if ( target ) syncPage( target.pageIndex ); fitFocus(); }
		const modalParent = modal.parentNode; const modalNextSibling = modal.nextSibling;
		function openModal() { rebuildSequence(); if ( ! sequence.length ) return; restoreFocus = document.activeElement; if ( modal.parentNode !== document.body ) document.body.appendChild( modal ); focusIndex = 0; syncPage( sequence[ 0 ].pageIndex ); modal.hidden = false; document.body.classList.add( 'amv-modal-open' ); fitFocus(); close.focus(); }
		function closeModal() { modal.hidden = true; document.body.classList.remove( 'amv-modal-open' ); if ( modal.parentNode === document.body ) modalParent.insertBefore( modal, modalNextSibling ); if ( restoreFocus && restoreFocus.focus ) restoreFocus.focus(); }
		openFocus.addEventListener( 'click', openModal ); close.addEventListener( 'click', closeModal ); modalPrevious.addEventListener( 'click', function() { if ( focusIndex === 0 ) closeModal(); else setFocus( focusIndex - 1 ); } ); modalNext.addEventListener( 'click', function() { if ( focusIndex === sequence.length - 1 ) closeModal(); else setFocus( focusIndex + 1 ); } ); modalPreviousEdge.addEventListener( 'click', function() { binding === 'rtl' ? setFocus( focusIndex + 1 ) : setFocus( focusIndex - 1 ); } ); modalNextEdge.addEventListener( 'click', function() { binding === 'rtl' ? setFocus( focusIndex - 1 ) : setFocus( focusIndex + 1 ); } ); overview.addEventListener( 'click', function() { showingOverview = ! showingOverview; fitFocus(); } );
		modal.addEventListener( 'keydown', function( event ) {
			if ( event.key === 'Tab' ) {
				const focusable = Array.from( modal.querySelectorAll( 'button:not(:disabled)' ) ).filter( function( button ) { return button.getClientRects().length > 0; } );
				const first = focusable[ 0 ], last = focusable[ focusable.length - 1 ];
				if ( event.shiftKey && document.activeElement === first ) { event.preventDefault(); last.focus(); }
				else if ( ! event.shiftKey && document.activeElement === last ) { event.preventDefault(); first.focus(); }
			}
			if ( event.key === 'Escape' ) { event.preventDefault(); closeModal(); }
			if ( event.key === 'ArrowLeft' ) { event.preventDefault(); setFocus( focusIndex + 1 ); }
			if ( event.key === 'ArrowRight' ) { event.preventDefault(); setFocus( focusIndex - 1 ); }
		} );
		modalStage.addEventListener( 'touchstart', function( event ) { focusTouchX = event.changedTouches[ 0 ].clientX; }, { passive: true } ); modalStage.addEventListener( 'touchend', function( event ) { if ( focusTouchX === null ) return; const delta = event.changedTouches[ 0 ].clientX - focusTouchX; focusTouchX = null; if ( Math.abs( delta ) >= 36 ) setFocus( focusIndex + ( delta < 0 ? 1 : -1 ) ); }, { passive: true } );
		window.addEventListener( 'resize', function() { if ( ! modal.hidden ) fitFocus(); } );
	}
	document.querySelectorAll( '.wp-block-ai-manga-viewer-viewer' ).forEach( init );
} )();
