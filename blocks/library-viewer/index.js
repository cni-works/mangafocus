( function( blocks, element, blockEditor, components, i18n, apiFetch, data ) {
	'use strict';
	const el = element.createElement;
	const { __ } = i18n;
	const { useBlockProps } = blockEditor;
	const { Button, Spinner, TextControl } = components;
	const attributes = { viewerId: { type: 'integer', default: 0 }, instanceKey: { type: 'string', default: '' } };
	function stableKey() { if ( window.crypto && typeof window.crypto.randomUUID === 'function' ) return 'instance-' + window.crypto.randomUUID(); return 'instance-' + Date.now().toString( 36 ) + '-' + Math.random().toString( 36 ).slice( 2, 12 ); }
	function flattenBlocks( source, result ) { ( source || [] ).forEach( function( block ) { result.push( block ); flattenBlocks( block.innerBlocks, result ); } ); return result; }

	function titleOf( item ) {
		if ( ! item || ! item.title ) return '';
		return item.title.raw || item.title.rendered || '';
	}

	function coverOf( item ) {
		if ( item && item.amv_cover_url ) return item.amv_cover_url;
		const media = item && item._embedded && item._embedded[ 'wp:featuredmedia' ];
		return media && media[ 0 ] && media[ 0 ].source_url ? media[ 0 ].source_url : '';
	}

	function statusOf( item ) {
		const labels = {
			publish: __( 'Published', 'mangafocus' ),
			draft: __( 'Draft', 'mangafocus' ),
			pending: __( 'Pending', 'mangafocus' ),
			private: __( 'Private', 'mangafocus' ),
			future: __( 'Scheduled', 'mangafocus' )
		};
		return item && labels[ item.status ] ? labels[ item.status ] : '';
	}

	function viewerCard( item, selectedId, onSelect ) {
		const selected = Number( item.id ) === selectedId;
		const cover = coverOf( item );
		const title = titleOf( item ) || __( 'Untitled comic', 'mangafocus' );
		return el( Button, {
			key: item.id,
			variant: selected ? 'primary' : 'secondary',
			onClick: function() { onSelect( Number( item.id ) ); },
			style: { display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '8px', boxSizing: 'border-box', width: '100%', minWidth: 0, maxWidth: '100%', height: 'auto', minHeight: '190px', overflow: 'hidden', padding: '8px', textAlign: 'left' },
			'aria-pressed': selected
		},
		cover ? el( 'img', { src: cover, alt: '', style: { display: 'block', width: '100%', height: '120px', objectFit: 'cover', borderRadius: '3px', background: '#f0f0f1' } } ) : el( 'span', { 'aria-hidden': 'true', style: { display: 'grid', placeItems: 'center', width: '100%', height: '120px', borderRadius: '3px', background: '#f0f0f1', color: '#646970', fontSize: '36px' } }, '▤' ),
		el( 'strong', { title: title, style: { display: '-webkit-box', width: '100%', minWidth: 0, minHeight: '2.7em', overflow: 'hidden', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflowWrap: 'anywhere', whiteSpace: 'normal', color: selected ? 'inherit' : '#1e1e1e', lineHeight: 1.35 } }, title ),
		el( 'small', { style: { color: selected ? 'inherit' : '#646970' } }, 'ID: ' + item.id + ( statusOf( item ) ? ' · ' + statusOf( item ) : '' ) ) );
	}

	function selectedSummary( item, viewerId ) {
		const cover = coverOf( item );
		return el( 'div', { style: { display: 'grid', justifyItems: 'center', gap: '10px', marginBottom: '14px', padding: '14px', border: '1px solid #dcdcde', borderRadius: '4px', background: '#f6f7f7', textAlign: 'center' } },
			cover ? el( 'img', { src: cover, alt: '', style: { display: 'block', width: 'min(100%,260px)', height: 'auto', maxHeight: '320px', objectFit: 'contain', borderRadius: '3px', background: '#fff' } } ) : el( 'span', { 'aria-hidden': 'true', style: { display: 'grid', placeItems: 'center', width: 'min(100%,260px)', aspectRatio: '3 / 4', maxHeight: '320px', borderRadius: '3px', background: '#e2e4e7', color: '#646970', fontSize: '56px' } }, '▤' ),
			el( 'div', { style: { maxWidth: '100%' } },
				el( 'strong', { style: { display: 'block', overflowWrap: 'anywhere' } }, titleOf( item ) || __( 'Untitled comic', 'mangafocus' ) ),
				el( 'span', { style: { display: 'block', marginTop: '4px', color: '#646970', fontSize: '12px' } }, 'Viewer ID: ' + viewerId ),
				statusOf( item ) ? el( 'span', { style: { display: 'block', marginTop: '2px', color: '#646970', fontSize: '12px' } }, statusOf( item ) ) : null,
				el( 'span', { style: { display: 'block', marginTop: '6px', color: '#646970', fontSize: '12px' } }, __( 'Only the cover is shown in the editor. The complete Viewer appears on the published page.', 'mangafocus' ) )
			)
		);
	}

	blocks.registerBlockType( 'ai-manga-viewer/library-viewer', {
		apiVersion: 3,
		title: __( 'Registered Viewer', 'mangafocus' ),
		icon: 'book-alt',
		category: 'ai-manga-viewer',
		description: __( 'Select and display one registered Viewer from Manga Library.', 'mangafocus' ),
		attributes: attributes,
		supports: { align: [ 'wide', 'full' ], anchor: true, html: false },
		edit: function( props ) {
			const viewerId = Number( props.attributes.viewerId ) || 0;
			const instanceKey = props.attributes.instanceKey || '';
			const instanceOwner = data.useSelect( function( select ) { if ( ! instanceKey ) return ''; const all = flattenBlocks( select( 'core/block-editor' ).getBlocks(), [] ); const owner = all.find( function( block ) { return block.name === 'ai-manga-viewer/library-viewer' && block.attributes && block.attributes.instanceKey === instanceKey; } ); return owner ? owner.clientId : ''; }, [ instanceKey ] );
			const itemsState = element.useState( [] ); const items = itemsState[ 0 ]; const setItems = itemsState[ 1 ];
			const selectedState = element.useState( null ); const selectedRecord = selectedState[ 0 ]; const setSelectedRecord = selectedState[ 1 ];
			const selectedErrorState = element.useState( '' ); const selectedError = selectedErrorState[ 0 ]; const setSelectedError = selectedErrorState[ 1 ];
			const loadingState = element.useState( true ); const loading = loadingState[ 0 ]; const setLoading = loadingState[ 1 ];
			const errorState = element.useState( '' ); const error = errorState[ 0 ]; const setError = errorState[ 1 ];
			const searchState = element.useState( '' ); const search = searchState[ 0 ]; const setSearch = searchState[ 1 ];
			const choosingState = element.useState( ! viewerId ); const choosing = choosingState[ 0 ]; const setChoosing = choosingState[ 1 ];
			const selectorRef = element.useRef( null );
			const previousChoosing = element.useRef( choosing );
			const blockProps = useBlockProps( { ref: selectorRef, className: 'amv-library-selector', style: { padding: '16px', border: '1px solid #c3c4c7', background: '#fff' } } );

			element.useEffect( function() { if ( ! instanceKey || ( instanceOwner && instanceOwner !== props.clientId ) ) props.setAttributes( { instanceKey: stableKey() } ); }, [ instanceKey, instanceOwner, props.clientId ] );

			element.useEffect( function() {
				let active = true;
				apiFetch( { path: '/wp/v2/ai-manga-viewers?context=edit&status=publish%2Cdraft%2Cpending%2Cprivate%2Cfuture&per_page=100&orderby=modified&order=desc&_embed=wp%3Afeaturedmedia&_fields=id%2Ctitle%2Cfeatured_media%2Cstatus%2Camv_cover_url%2C_embedded' } ).then( function( records ) {
					if ( active ) { setItems( Array.isArray( records ) ? records : [] ); setLoading( false ); }
				} ).catch( function() {
					if ( active ) { setError( __( 'Could not load Manga Library.', 'mangafocus' ) ); setLoading( false ); }
				} );
				return function() { active = false; };
			}, [] );

			element.useEffect( function() {
				let active = true;
				setSelectedError( '' );
				if ( ! viewerId ) { setSelectedRecord( null ); return function() { active = false; }; }
				apiFetch( { path: '/wp/v2/ai-manga-viewers/' + viewerId + '?context=edit&_embed=wp%3Afeaturedmedia&_fields=id%2Ctitle%2Cfeatured_media%2Cstatus%2Camv_cover_url%2C_embedded' } ).then( function( record ) {
					if ( active ) setSelectedRecord( record || null );
				} ).catch( function() {
					if ( active ) { setSelectedRecord( null ); setSelectedError( __( 'The selected Viewer could not be found. It may have been deleted or its permissions may have changed.', 'mangafocus' ) ); }
				} );
				return function() { active = false; };
			}, [ viewerId ] );

			element.useEffect( function() {
				const wasChoosing = previousChoosing.current;
				previousChoosing.current = choosing;
				if ( ! choosing || wasChoosing ) return;
				const frame = window.requestAnimationFrame( function() {
					const selector = selectorRef.current;
					if ( ! selector ) return;
					selector.scrollIntoView( { behavior: 'auto', block: 'start' } );
					const searchInput = selector.querySelector( 'input[type="text"], input[type="search"]' );
					if ( searchInput ) searchInput.focus( { preventScroll: true } );
				} );
				return function() { window.cancelAnimationFrame( frame ); };
			}, [ choosing ] );

			const selected = selectedRecord || items.find( function( item ) { return Number( item.id ) === viewerId; } );
			const query = search.trim().toLocaleLowerCase();
			const visible = query ? items.filter( function( item ) { return titleOf( item ).toLocaleLowerCase().indexOf( query ) !== -1 || String( item.id ) === query; } ) : items;
			const choose = function( id ) {
				const item = items.find( function( record ) { return Number( record.id ) === id; } ) || null;
				setSelectedRecord( item ); setSelectedError( '' ); props.setAttributes( { viewerId: id } ); setChoosing( false );
			};
			const clear = function() { props.setAttributes( { viewerId: 0 } ); setSelectedRecord( null ); setSelectedError( '' ); setChoosing( true ); };

			return el( 'div', blockProps,
			el( 'strong', { style: { display: 'block', marginBottom: '10px' } }, __( 'Registered Viewer', 'mangafocus' ) ),
			viewerId && ! choosing ? el( 'div', null,
				selected ? selectedSummary( selected, viewerId ) : el( 'p', null, __( 'Selected Viewer', 'mangafocus' ), ' · ID: ', viewerId ),
				selectedError ? el( 'p', { role: 'alert', style: { color: '#b32d2e' } }, selectedError ) : null,
				el( 'div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' } },
					el( Button, { variant: 'secondary', onClick: function() { setChoosing( true ); } }, __( 'Choose again from Manga Library', 'mangafocus' ) ),
					el( Button, { variant: 'tertiary', isDestructive: true, onClick: clear }, __( 'Clear selection', 'mangafocus' ) )
				)
			) : null,
			choosing ? el( 'div', null,
				el( TextControl, { label: __( 'Search by title or Viewer ID', 'mangafocus' ), value: search, onChange: setSearch } ),
				loading ? el( Spinner ) : null,
				error ? el( 'p', { role: 'alert', style: { color: '#b32d2e' } }, error ) : null,
				! loading && ! error && ! visible.length ? el( 'p', null, __( 'No comics are available for selection.', 'mangafocus' ) ) : null,
				visible.length ? el( 'div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: '10px' } }, visible.map( function( item ) { return viewerCard( item, viewerId, choose ); } ) ) : null,
				viewerId ? el( Button, { variant: 'tertiary', onClick: function() { setChoosing( false ); }, style: { marginTop: '10px' } }, __( 'Keep current selection', 'mangafocus' ) ) : null
			) : null );
		},
		save: function() { return null; }
	} );
} )( window.wp.blocks, window.wp.element, window.wp.blockEditor, window.wp.components, window.wp.i18n, window.wp.apiFetch, window.wp.data );
