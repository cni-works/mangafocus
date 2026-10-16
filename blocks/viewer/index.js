( function( blocks, element, blockEditor, components, i18n, data, apiFetch ) {
	'use strict';
	const el = element.createElement;
	const { __ } = i18n;
	const layout = window.aiMangaViewerLayout;
	const hooks = window.wp.hooks;
	const { InspectorControls, MediaUpload, MediaUploadCheck, useBlockProps } = blockEditor;
	const { Button, PanelBody, RangeControl, SelectControl, TextControl, ToggleControl } = components;
	const attributes = { pages: { type: 'array', default: [] }, viewerKey: { type: 'string', default: '' }, instanceKey: { type: 'string', default: '' }, libraryViewerId: { type: 'integer', default: 0 }, binding: { type: 'string', default: 'rtl' }, pageLayout: { type: 'string', default: 'single' }, singleFirstPage: { type: 'boolean', default: true }, spreadReadingMode: { type: 'string', default: 'overview' }, maxWidth: { type: 'number', default: 650 }, showPageNumbers: { type: 'boolean', default: true }, enableEdgeClick: { type: 'boolean', default: true }, showGuideArrowOnAllPages: { type: 'boolean', default: false }, enableAnimation: { type: 'boolean', default: true }, enableInline: { type: 'boolean' }, enableFullscreen: { type: 'boolean', default: false }, fullscreenStartAtCurrent: { type: 'boolean', default: false }, inlineDisplayMode: { type: 'string', default: 'reader' }, fullscreenReadingMode: { type: 'string', default: 'paged' }, enableZoom: { type: 'boolean', default: false }, zoomControlsPosition: { type: 'string', default: 'bottom' }, scrollAssist: { type: 'boolean', default: false }, scrollAssistPosition: { type: 'string', default: 'auto' }, scrollAssistStrength: { type: 'string', default: 'normal' }, focusReader: { type: 'boolean', default: false }, focusReaderStartAtCurrent: { type: 'boolean', default: false }, mobileFocusReader: { type: 'boolean', default: false } };
	function clamp( value, min, max ) { return Math.max( min, Math.min( max, typeof value === 'number' ? value : min ) ); }
	function stableKey( prefix ) { if ( window.crypto && typeof window.crypto.randomUUID === 'function' ) return prefix + '-' + window.crypto.randomUUID(); return prefix + '-' + Date.now().toString( 36 ) + '-' + Math.random().toString( 36 ).slice( 2, 12 ); }
	function flattenBlocks( source, result ) { ( source || [] ).forEach( function( block ) { result.push( block ); flattenBlocks( block.innerBlocks, result ); } ); return result; }
	function areasOf( page, mobile ) { const key = mobile ? 'mobileFocusAreas' : 'focusAreas'; return Array.isArray( page && page[ key ] ) ? page[ key ] : []; }
	// Absence of enableInline retains the 0.3.0 interpretation; false is a saved choice.
	function readingModes( a ) { const modern = typeof a.enableInline === 'boolean'; const cover = a.inlineDisplayMode === 'coverLauncher'; return { inline: modern ? a.enableInline : ! cover, fullscreen: modern ? !! a.enableFullscreen : ( cover || !! a.enableFullscreen ), panel: !! a.focusReader }; }
	function hasPanelAreas( a ) { return ( Array.isArray( a.pages ) ? a.pages : [] ).some( function( page ) { return areasOf( page ).length > 0 || ( a.mobileFocusReader && areasOf( page, true ).length > 0 ); } ); }
	function mediaDimensions( media, previous ) { const details = media && media.media_details && typeof media.media_details === 'object' ? media.media_details : {}; const width = Number( media && ( media.width || details.width ) ) || Number( previous && previous.width ) || 0; const height = Number( media && ( media.height || details.height ) ) || Number( previous && previous.height ) || 0; return { width: width, height: height }; }
	function pageFromMedia( media, previous ) { const dimensions = mediaDimensions( media, previous ); const item = { id: media.id || 0, url: media.url || '', alt: media.alt || '', thumbnailUrl: media.sizes && media.sizes.thumbnail ? media.sizes.thumbnail.url : ( media.url || '' ), width: dimensions.width, height: dimensions.height, pageKey: previous && typeof previous.pageKey === 'string' && previous.pageKey ? previous.pageKey : stableKey( 'page' ), focusAreas: areasOf( previous ), mobileFocusAreas: areasOf( previous, true ) }; if ( previous && previous.cta ) item.cta = Object.assign( {}, previous.cta ); return item; }
	function pageLabel( index, count ) { return index === 0 ? __( 'Page', 'mangafocus' ) + ' 1' : ( index === count - 1 && count > 1 ? __( 'Back matter', 'mangafocus' ) : __( 'Page', 'mangafocus' ) + ' ' + ( index + 1 ) ); }
	function editorExtensions( name, context ) { if ( ! hooks || typeof hooks.applyFilters !== 'function' ) return []; const result = hooks.applyFilters( name, [], context ); return Array.isArray( result ) ? result.filter( Boolean ) : []; }

	// Cover controls belong to the selected Library block Inspector.
	function LibraryCoverControls( props ) {
		const state = props.state;
		const media = state.media;
		const url = media && ( media.media_details && media.media_details.sizes && media.media_details.sizes.medium ? media.media_details.sizes.medium.source_url : media.source_url );
		function choose( image ) { const id = Number( image && image.id ); if ( Number.isInteger( id ) && id > 0 && ( ! image.type || image.type === 'image' ) ) props.editPost( { featured_media: id } ); }
		return el( element.Fragment, null,
			el( 'p', null, __( 'Set the cover used in the comic list and before reading.', 'mangafocus' ) ),
			el( 'p', { className: 'description' }, __( 'Set the cover here. The standard Featured image panel is also available as a fallback and uses the same image.', 'mangafocus' ) ),
			state.id ? ( url ? el( 'img', { src: url, alt: __( 'Selected cover preview', 'mangafocus' ), style: { maxWidth: '100%', height: 'auto' } } ) : el( 'p', null, __( 'Cover selected. Its preview is loading or unavailable.', 'mangafocus' ) ) ) : el( element.Fragment, null,
				el( 'p', null, __( 'No cover image is set. The first page is displayed instead; it is not saved as a cover.', 'mangafocus' ) ),
				state.fallback ? el( 'figure', null, el( 'img', { src: state.fallback, alt: '', style: { maxWidth: '100%', height: 'auto' } } ), el( 'figcaption', null, __( 'First-page preview (not a saved cover)', 'mangafocus' ) ) ) : null ),
			el( MediaUpload, { allowedTypes: [ 'image' ], multiple: false, value: state.id, onSelect: choose, render: function( upload ) { return el( Button, { variant: 'secondary', onClick: upload.open }, state.id ? __( 'Change cover image', 'mangafocus' ) : __( 'Select cover image', 'mangafocus' ) ); } } ),
			state.id ? el( Button, { variant: 'tertiary', onClick: function() { props.editPost( { featured_media: 0 } ); } }, __( 'Remove cover image', 'mangafocus' ) ) : null,
			el( 'p', { className: 'description' }, __( 'This preview reflects your edits. Save with Publish or Update. Removing a cover does not delete the image file.', 'mangafocus' ) ),
			state.failed ? el( 'p', { role: 'alert' }, __( 'The last save failed. The cover shown here may not be saved yet.', 'mangafocus' ) ) : null );
	}
	function LibraryCoverPanel( props ) {
		const state = data.useSelect( function( select ) {
			try {
				const editor = select( 'core/editor' ), core = select( 'core' );
				if ( ! editor || ! core || ! editor.getCurrentPostType || editor.getCurrentPostType() !== 'amv_viewer' || ! editor.getEditedPostAttribute || ! core.getMedia || ! core.getPostType || ! core.canUserEditEntityRecord ) return null;
				const postType = core.getPostType( 'amv_viewer' );
				if ( ! postType || ! postType.supports || ! postType.supports.thumbnail || core.canUserEditEntityRecord( 'postType', 'amv_viewer', editor.getCurrentPostId() ) !== true ) return null;
				const raw = editor.getEditedPostAttribute( 'featured_media' );
				if ( ! Number.isInteger( raw ) || raw < 0 ) return null;
				const first = Array.isArray( props.pages ) ? props.pages[ 0 ] : null;
				return { id: raw, media: raw ? core.getMedia( raw, { context: 'view' } ) : null, fallback: first ? ( first.thumbnailUrl || first.url || '' ) : '', failed: editor.didPostSaveRequestFail ? editor.didPostSaveRequestFail() : false };
			} catch ( error ) { return null; }
		}, [ props.pages ] );
		if ( ! state || ! MediaUpload || ! MediaUploadCheck ) return null;
		let editorActions;
		try { editorActions = data.dispatch( 'core/editor' ); } catch ( error ) { return null; }
		if ( ! editorActions || typeof editorActions.editPost !== 'function' ) return null;
		// Keep the native fallback: panel removal has no public inverse when this block
		// is deselected, deleted, or its cover controls become unavailable. Never change user preferences.
		return el( PanelBody, { title: __( 'Cover image', 'mangafocus' ), initialOpen: true },
			el( MediaUploadCheck, { fallback: null }, el( LibraryCoverControls, { state: state, editPost: editorActions.editPost } ) ) );
	}

	blocks.registerBlockType( 'ai-manga-viewer/viewer', {
		apiVersion: 3, title: __( 'MangaFocus', 'mangafocus' ), icon: 'book-alt', category: 'ai-manga-viewer', description: __( 'Display manga images with paged, spread, fullscreen, and Panel-by-Panel reading.', 'mangafocus' ), keywords: [ __( 'Manga', 'mangafocus' ), __( 'Comic', 'mangafocus' ), __( 'Viewer', 'mangafocus' ), __( 'Panel-by-Panel', 'mangafocus' ) ], attributes: attributes, supports: { align: [ 'wide', 'full' ], anchor: true, html: false },
		edit: function( props ) {
			const a = props.attributes; const set = props.setAttributes;
			const instanceOwner = data.useSelect( function( select ) { if ( ! a.instanceKey ) return ''; const all = flattenBlocks( select( 'core/block-editor' ).getBlocks(), [] ); const owner = all.find( function( block ) { return block.name === 'ai-manga-viewer/viewer' && block.attributes && block.attributes.instanceKey === a.instanceKey; } ); return owner ? owner.clientId : ''; }, [ a.instanceKey ] );
			const editorContext = data.useSelect( function( select ) { const editor = select( 'core/editor' ); return { postType: editor && editor.getCurrentPostType ? editor.getCurrentPostType() : '', postId: editor && editor.getCurrentPostId ? Number( editor.getCurrentPostId() ) || 0 : 0, title: editor && editor.getEditedPostAttribute ? ( editor.getEditedPostAttribute( 'title' ) || '' ) : '' }; }, [] );
			const currentPostType = editorContext.postType;
			const isLibraryEditor = currentPostType === 'amv_viewer';
			const editedCover = data.useSelect( function( select ) { if ( ! isLibraryEditor ) return null; try { const editor = select( 'core/editor' ), core = select( 'core' ); const id = editor.getEditedPostAttribute( 'featured_media' ); const media = id && core && core.getMedia ? core.getMedia( id, { context: 'view' } ) : null; return { id: Number( id ) || 0, url: media ? media.source_url || '' : '' }; } catch ( error ) { return null; } }, [ isLibraryEditor ] );
			const registrationTitleState = element.useState( editorContext.title || __( 'Untitled comic', 'mangafocus' ) ); const registrationTitle = registrationTitleState[ 0 ]; const setRegistrationTitle = registrationTitleState[ 1 ];
			const registrationState = element.useState( null ); const registration = registrationState[ 0 ]; const setRegistration = registrationState[ 1 ];
			const registrationErrorState = element.useState( '' ); const registrationError = registrationErrorState[ 0 ]; const setRegistrationError = registrationErrorState[ 1 ];
			const registeringState = element.useState( false ); const registering = registeringState[ 0 ]; const setRegistering = registeringState[ 1 ];
			const pages = Array.isArray( a.pages ) ? a.pages.filter( function( page ) { return page && page.url; } ) : [];
			const reading = readingModes( a );
			const modeNoticeState = element.useState( null ); const modeNotice = modeNoticeState[ 0 ]; const setModeNotice = modeNoticeState[ 1 ];
			function setReadingMode( mode, enabled ) {
				const next = Object.assign( {}, reading, { [ mode ]: !! enabled } );
				if ( ! next.inline && ! next.fullscreen && ! next.panel ) { setModeNotice( { mode: mode, message: __( 'Keep at least one reading mode enabled.', 'mangafocus' ) } ); return false; }
				if ( ! next.inline && ! next.fullscreen && ! hasPanelAreas( a ) ) { setModeNotice( { mode: mode, message: __( 'Add at least one panel before using panel reading alone.', 'mangafocus' ) } ); return false; }
				setModeNotice( null ); set( { enableInline: next.inline, enableFullscreen: next.fullscreen, focusReader: next.panel } ); return true;
			}
			const currentState = element.useState( 0 ); const current = Math.min( currentState[ 0 ], Math.max( 0, pages.length - 1 ) ); const setCurrent = currentState[ 1 ];
			const dragIndexState = element.useState( null ); const dragIndex = dragIndexState[ 0 ]; const setDragIndex = dragIndexState[ 1 ];
			const dimensionsState = element.useState( {} ); const loadedDimensions = dimensionsState[ 0 ]; const setLoadedDimensions = dimensionsState[ 1 ];
			element.useEffect( function() { const rawPages = Array.isArray( a.pages ) ? a.pages : []; const duplicated = !! ( instanceOwner && instanceOwner !== props.clientId ); let changed = ! a.viewerKey || ! a.instanceKey || duplicated; const keyedPages = rawPages.map( function( item ) { if ( ! item || typeof item !== 'object' ) return item; let next = item; if ( ! item.pageKey ) { next = Object.assign( {}, next, { pageKey: stableKey( 'page' ) } ); changed = true; } if ( item.cta && typeof item.cta === 'object' && ! item.cta.ctaKey ) { next = Object.assign( {}, next, { cta: Object.assign( {}, item.cta, { ctaKey: stableKey( 'cta' ) } ) } ); changed = true; } return next; } ); if ( changed ) set( { viewerKey: a.viewerKey || stableKey( 'viewer' ), instanceKey: ! a.instanceKey || duplicated ? stableKey( 'instance' ) : a.instanceKey, libraryViewerId: duplicated ? 0 : ( Number( a.libraryViewerId ) || 0 ), pages: keyedPages } ); }, [ a.instanceKey, instanceOwner, props.clientId ] );
			element.useEffect( function() { let active = true; const id = Number( a.libraryViewerId ) || 0; if ( ! id || registration ) return function() { active = false; }; apiFetch( { path: '/wp/v2/ai-manga-viewers/' + id + '?context=edit&_fields=id%2Ctitle%2Cstatus' } ).then( function( item ) { if ( active && item ) setRegistration( { id: id, title: item.title && ( item.title.raw || item.title.rendered ) ? ( item.title.raw || item.title.rendered ) : registrationTitle, editUrl: 'post.php?post=' + id + '&action=edit', shortcode: '[ai_manga_viewer id="' + id + '"]', duplicate: true, status: item.status || '', canSwitch: item.status === 'publish' } ); } ).catch( function() {} ); return function() { active = false; }; }, [ a.libraryViewerId ] );
			const page = pages[ current ];
			const dimensionKey = function( item, index ) { return ( item && ( item.pageKey || item.id || item.url ) ) || String( index ); };
			const pageDimensions = pages.map( function( item, index ) { const saved = mediaDimensions( item ); return saved.width > 0 && saved.height > 0 ? saved : ( loadedDimensions[ dimensionKey( item, index ) ] || {} ); } );
			const spreadAnalysis = layout.analyzePages( pageDimensions, a.singleFirstPage !== false );
			const spreadUnavailable = spreadAnalysis.status === 'unavailable' && layout.analyzePages( pageDimensions, false ).status === 'unavailable';
			const rememberDimensions = function( item, index, image ) { if ( ! image || ! image.naturalWidth || ! image.naturalHeight ) return; const key = dimensionKey( item, index ); setLoadedDimensions( function( currentDimensions ) { const known = currentDimensions[ key ]; if ( known && known.width === image.naturalWidth && known.height === image.naturalHeight ) return currentDimensions; return Object.assign( {}, currentDimensions, { [ key ]: { width: image.naturalWidth, height: image.naturalHeight } } ); } ); };
			const dimensionSignature = pages.map( function( item, index ) { const saved = mediaDimensions( item ); return dimensionKey( item, index ) + ':' + ( item.id || 0 ) + ':' + ( item.url || '' ) + ':' + saved.width + 'x' + saved.height; } ).join( '|' );
			element.useEffect( function() {
				let active = true; const probes = [];
				const unresolved = pages.map( function( item, index ) { return { item: item, index: index, saved: mediaDimensions( item ) }; } ).filter( function( entry ) { return ! ( entry.saved.width > 0 && entry.saved.height > 0 ); } );
				function probe( entries ) { entries.forEach( function( entry ) { if ( ! entry.item.url ) return; const image = new window.Image(); probes.push( image ); image.onload = function() { if ( active ) rememberDimensions( entry.item, entry.index, image ); }; image.src = entry.item.url; } ); }
				probe( unresolved.filter( function( entry ) { return ! Number( entry.item.id ); } ) );
				const withIds = unresolved.filter( function( entry ) { return Number( entry.item.id ) > 0; } );
				for ( let offset = 0; offset < withIds.length; offset += 100 ) {
					const chunk = withIds.slice( offset, offset + 100 ); const ids = Array.from( new Set( chunk.map( function( entry ) { return Number( entry.item.id ); } ) ) );
					apiFetch( { path: '/wp/v2/media?include=' + encodeURIComponent( ids.join( ',' ) ) + '&per_page=100&_fields=id%2Cmedia_details' } ).then( function( mediaItems ) {
						if ( ! active ) return; const resolved = {};
						( Array.isArray( mediaItems ) ? mediaItems : [] ).forEach( function( media ) { const dimensions = mediaDimensions( media ); if ( dimensions.width > 0 && dimensions.height > 0 ) resolved[ Number( media.id ) ] = dimensions; } );
						setLoadedDimensions( function( currentDimensions ) { const next = Object.assign( {}, currentDimensions ); chunk.forEach( function( entry ) { const dimensions = resolved[ Number( entry.item.id ) ]; if ( dimensions ) next[ dimensionKey( entry.item, entry.index ) ] = dimensions; } ); return next; } );
						probe( chunk.filter( function( entry ) { return ! resolved[ Number( entry.item.id ) ]; } ) );
					} ).catch( function() { if ( active ) probe( chunk ); } );
				}
				return function() { active = false; probes.forEach( function( image ) { image.onload = null; image.src = ''; } ); };
			}, [ dimensionSignature ] );
			const maxWidth = typeof a.maxWidth === 'number' ? clamp( a.maxWidth, 320, 1600 ) : 650;
			const zoomPosition = [ 'right', 'left' ].indexOf( a.zoomControlsPosition ) !== -1 ? a.zoomControlsPosition : 'bottom';
			const blockProps = useBlockProps( { className: 'amv-reader amv-reader--editor', 'data-zoom-position': zoomPosition, style: { '--amv-reader-max-width': maxWidth + 'px' } } );
			const updatePage = function( values ) { if ( ! page ) return; set( { pages: pages.map( function( item, index ) { return index === current ? Object.assign( {}, item, values ) : item; } ) } ); };
			const extensionContext = { apiVersion: 1, clientId: props.clientId, attributes: a, setAttributes: set, setReadingMode: setReadingMode, readingModes: reading, currentPageIndex: current, currentPage: page || null, updateCurrentPage: updatePage, panelReaderSettingsGrouped: true };
			const editorInspectorExtensions = editorExtensions( 'aiMangaViewer.editor.inspectorPanels', extensionContext );
			// Internal placement hook; public add-on inspector/stage hooks remain unchanged.
			const editorPanelSettings = editorExtensions( 'mangafocus.editor.panelReaderSettings', extensionContext );
			const editorStageExtensions = editorExtensions( 'aiMangaViewer.editor.stageOverlays', extensionContext );
			const editorAuxiliaryExtensions = editorExtensions( 'aiMangaViewer.editor.auxiliary', extensionContext );
			const replacePages = function( items ) { const selectedItems = Array.isArray( items ) ? items : []; set( { pages: selectedItems.filter( function( media ) { return media && media.url; } ).map( function( media ) { return pageFromMedia( media, pages.find( function( old ) { return old.id && old.id === media.id; } ) ); } ) } ); setCurrent( 0 ); };
			const reorderPage = function( from, to ) { if ( to < 0 || to >= pages.length || from === to ) return; const next = pages.slice(); next.splice( to, 0, next.splice( from, 1 )[ 0 ] ); set( { pages: next } ); setCurrent( to ); };
			const mediaSelect = el( MediaUploadCheck, null, el( MediaUpload, { onSelect: replacePages, allowedTypes: [ 'image' ], multiple: true, gallery: true, value: pages.map( function( item ) { return item.id; } ), render: function( propsMedia ) { return el( Button, { variant: pages.length ? 'secondary' : 'primary', onClick: propsMedia.open }, pages.length ? __( 'Edit page images', 'mangafocus' ) : __( 'Select page images', 'mangafocus' ) ); } } ) );
			const zoomPreview = function( modifier ) { return el( 'div', { className: 'amv-reader__zoom-controls ' + modifier, 'aria-label': __( 'Zoom control position preview', 'mangafocus' ) }, el( 'button', { type: 'button', tabIndex: -1, onClick: function( event ) { event.preventDefault(); } }, '−' ), el( 'output', { className: 'amv-reader__zoom-level' }, '100%' ), el( 'button', { type: 'button', tabIndex: -1, onClick: function( event ) { event.preventDefault(); } }, '＋' ), el( 'button', { type: 'button', className: 'amv-reader__zoom-reset', tabIndex: -1, onClick: function( event ) { event.preventDefault(); } }, __( 'Fit', 'mangafocus' ) ) ); };
			const registeredId = Number( a.libraryViewerId ) || Number( registration && registration.id ) || 0;
			const registerInLibrary = function() {
				if ( registering ) return;
				setRegistrationError( '' ); setRegistering( true );
				apiFetch( { path: '/ai-manga-viewer/v1/library', method: 'POST', data: { title: registrationTitle, sourcePostId: editorContext.postId, sourceInstanceKey: a.instanceKey || '', existingViewerId: Number( a.libraryViewerId ) || 0, attributes: a } } ).then( function( result ) {
					setRegistration( result ); setRegistering( false );
					if ( result && result.id && Number( a.libraryViewerId ) !== Number( result.id ) ) set( { libraryViewerId: Number( result.id ) } );
				} ).catch( function( error ) {
					setRegistering( false ); setRegistrationError( error && error.message ? error.message : __( 'Could not register the comic in Manga Library.', 'mangafocus' ) );
				} );
			};
			const copyRegisteredShortcode = function() { const shortcode = registration && registration.shortcode ? registration.shortcode : '[ai_manga_viewer id="' + registeredId + '"]'; if ( navigator.clipboard && navigator.clipboard.writeText ) navigator.clipboard.writeText( shortcode ); };
			const switchToLibraryViewer = function() { if ( ! registeredId ) return; data.dispatch( 'core/block-editor' ).replaceBlock( props.clientId, blocks.createBlock( 'ai-manga-viewer/library-viewer', { viewerId: registeredId, instanceKey: stableKey( 'instance' ) } ) ); };
			const registrationPanel = registeredId ? el( 'div', { className: 'amv-reader__library-registration is-registered' },
				el( 'p', null, registration && registration.duplicate ? __( 'This block is already registered in Manga Library.', 'mangafocus' ) : __( 'Registered in Manga Library. The original Viewer was not changed.', 'mangafocus' ) ),
				el( 'p', null, el( 'strong', null, registration && registration.title ? registration.title : registrationTitle ), el( 'br' ), __( 'Viewer ID:', 'mangafocus' ) + ' ', registeredId ),
				registration && registration.canSwitch === false ? el( 'p', { className: 'description' }, __( 'This comic is registered as a draft. Publish it before replacing this block with a Registered Viewer.', 'mangafocus' ) ) : null,
				el( 'div', { className: 'amv-reader__library-registration-actions' },
					el( Button, { variant: 'secondary', href: registration && registration.editUrl ? registration.editUrl : 'post.php?post=' + registeredId + '&action=edit', target: '_blank' }, __( 'Edit registered comic', 'mangafocus' ) ),
					el( Button, { variant: 'secondary', onClick: copyRegisteredShortcode }, __( 'Copy shortcode', 'mangafocus' ) ),
					registration && registration.canSwitch === true ? el( Button, { variant: 'primary', onClick: switchToLibraryViewer }, __( 'Replace this block with a Registered Viewer', 'mangafocus' ) ) : null
				)
			) : el( 'div', { className: 'amv-reader__library-registration' },
				el( 'p', { className: 'description' }, __( 'Copy the current pages and Viewer settings as an independent comic. Saved extension settings are retained and the original Viewer is not changed.', 'mangafocus' ) ),
				el( TextControl, { label: __( 'Title', 'mangafocus' ), value: registrationTitle, onChange: setRegistrationTitle } ),
				pages.length ? el( 'div', { className: 'amv-reader__library-cover-preview' }, el( 'img', { src: pages[ 0 ].thumbnailUrl || pages[ 0 ].url, alt: '' } ), el( 'span', null, __( 'The first page is a preview until you select a cover in Manga Library.', 'mangafocus' ) ) ) : null,
				registrationError ? el( 'p', { className: 'components-notice is-error', role: 'alert' }, registrationError ) : null,
				el( Button, { variant: 'primary', onClick: registerInLibrary, isBusy: registering, disabled: registering || ! pages.length || ! registrationTitle.trim() }, registering ? __( 'Registering…', 'mangafocus' ) : __( 'Register in Manga Library', 'mangafocus' ) )
			);
			return el( element.Fragment, null,
				el( InspectorControls, null,
					! isLibraryEditor ? el( PanelBody, { title: __( 'Register in Manga Library', 'mangafocus' ), initialOpen: false, className: 'amv-reader__library-guidance' }, el( 'p', { className: 'description' }, __( 'To use Manga Analytics and AI consultation, register the comic in Manga Library and display it as a Registered Viewer.', 'mangafocus' ) ), registrationPanel ) : null,
					isLibraryEditor && props.isSelected ? el( LibraryCoverPanel, { pages: pages } ) : null,
					el( PanelBody, { title: __( 'Page images', 'mangafocus' ), initialOpen: true }, mediaSelect, pages.length ? el( 'p', { className: 'description' }, __( 'The first image is page 1 and the last is the back matter. Drag images or use the arrows to reorder them.', 'mangafocus' ) ) : null, pages.length ? el( 'div', { className: 'amv-reader__page-list' }, pages.map( function( item, index ) { return el( 'div', { key: ( item.id || item.url ) + '-' + index, className: 'amv-reader__page-item' + ( dragIndex === index ? ' is-dragging' : '' ), draggable: true, onDragStart: function() { setDragIndex( index ); }, onDragOver: function( event ) { event.preventDefault(); }, onDrop: function( event ) { event.preventDefault(); if ( dragIndex !== null ) reorderPage( dragIndex, index ); setDragIndex( null ); }, onDragEnd: function() { setDragIndex( null ); } }, el( 'img', { src: item.thumbnailUrl || item.url, alt: '' } ), el( Button, { className: 'amv-reader__page-name', variant: current === index ? 'primary' : 'tertiary', onClick: function() { setCurrent( index ); } }, pageLabel( index, pages.length ) ), el( Button, { icon: 'arrow-up-alt2', label: __( 'Move up', 'mangafocus' ), disabled: index === 0, onClick: function() { reorderPage( index, index - 1 ); } } ), el( Button, { icon: 'arrow-down-alt2', label: __( 'Move down', 'mangafocus' ), disabled: index === pages.length - 1, onClick: function() { reorderPage( index, index + 1 ); } } ), el( Button, { icon: 'trash', label: __( 'Delete', 'mangafocus' ), isDestructive: true, onClick: function() { set( { pages: pages.filter( function( value, valueIndex ) { return valueIndex !== index; } ) } ); setCurrent( Math.max( 0, current - ( index <= current ? 1 : 0 ) ) ); } } ) ); } ) ) : null ),
					el( PanelBody, { title: __( 'Inline viewer', 'mangafocus' ), initialOpen: true },
						el( ToggleControl, { label: __( 'Enable inline viewer', 'mangafocus' ), help: __( 'On: read within the post or page. Off: show a cover with buttons for the other enabled modes. Page images and panel settings are kept.', 'mangafocus' ), checked: reading.inline, onChange: function( value ) { setReadingMode( 'inline', value ); } } ),
						modeNotice && modeNotice.mode === 'inline' ? el( 'p', { role: 'alert' }, modeNotice.message ) : null,
						reading.inline ? el( element.Fragment, null,
							el( ToggleControl, { label: __( 'Automatically adjust scroll position', 'mangafocus' ), help: __( 'After document scrolling stops, adjust the comic position in the viewport. This is not automatic alignment on page turns.', 'mangafocus' ), checked: !! a.scrollAssist, onChange: function( value ) { set( { scrollAssist: !! value } ); } } ),
							a.scrollAssist ? el( element.Fragment, null, el( SelectControl, { label: __( 'Scroll adjustment position', 'mangafocus' ), value: [ 'auto', 'top', 'center' ].indexOf( a.scrollAssistPosition ) !== -1 ? a.scrollAssistPosition : 'auto', options: [ { label: __( 'Automatic (center when it fits)', 'mangafocus' ), value: 'auto' }, { label: __( 'Top of screen', 'mangafocus' ), value: 'top' }, { label: __( 'Center of screen', 'mangafocus' ), value: 'center' } ], onChange: function( value ) { set( { scrollAssistPosition: value } ); } } ), el( SelectControl, { label: __( 'Scroll adjustment strength', 'mangafocus' ), value: [ 'gentle', 'normal', 'strong' ].indexOf( a.scrollAssistStrength ) !== -1 ? a.scrollAssistStrength : 'normal', options: [ { label: __( 'Gentle', 'mangafocus' ), value: 'gentle' }, { label: __( 'Normal', 'mangafocus' ), value: 'normal' }, { label: __( 'Strong', 'mangafocus' ), value: 'strong' } ], onChange: function( value ) { set( { scrollAssistStrength: value } ); } } ) ) : null
						) : null ),
					el( PanelBody, { title: __( 'Fullscreen mode', 'mangafocus' ), initialOpen: true },
						el( ToggleControl, { label: __( 'Enable fullscreen mode', 'mangafocus' ), help: __( 'On: offer fullscreen paged or vertical reading. Off: hide the fullscreen launch button.', 'mangafocus' ), checked: reading.fullscreen, onChange: function( value ) { setReadingMode( 'fullscreen', value ); } } ),
						modeNotice && modeNotice.mode === 'fullscreen' ? el( 'p', { role: 'alert' }, modeNotice.message ) : null,
						reading.fullscreen ? el( element.Fragment, null,
							reading.fullscreen ? el( SelectControl, { label: __( 'Fullscreen reading mode', 'mangafocus' ), help: a.fullscreenReadingMode === 'vertical' ? __( 'Read all pages by scrolling from top to bottom.', 'mangafocus' ) : __( 'Use the current page navigation mode in fullscreen.', 'mangafocus' ), value: a.fullscreenReadingMode === 'vertical' ? 'vertical' : 'paged', options: [ { label: __( 'Paged reading', 'mangafocus' ), value: 'paged' }, { label: __( 'Vertical scrolling', 'mangafocus' ), value: 'vertical' } ], onChange: function( value ) { set( { fullscreenReadingMode: value === 'vertical' ? 'vertical' : 'paged' } ); } } ) : null,
							reading.fullscreen ? el( ToggleControl, { label: __( 'Start fullscreen from the current page', 'mangafocus' ), help: __( 'When disabled, fullscreen starts from the first page. The cover launcher always starts from the first page.', 'mangafocus' ), checked: !! a.fullscreenStartAtCurrent, disabled: ! reading.inline, onChange: function( value ) { set( { fullscreenStartAtCurrent: !! value } ); } } ) : null,
							reading.fullscreen && a.fullscreenReadingMode !== 'vertical' && [ 'spread', 'auto' ].indexOf( a.pageLayout ) !== -1 ? el( SelectControl, { label: __( 'Fullscreen spread reading mode', 'mangafocus' ), help: __( 'Show the entire spread in the normal view and use the selected mode only in fullscreen.', 'mangafocus' ), value: a.spreadReadingMode === 'pageFocus' ? 'pageFocus' : 'overview', options: [ { label: __( 'Entire spread', 'mangafocus' ), value: 'overview' }, { label: __( 'Focus on one page at a time', 'mangafocus' ), value: 'pageFocus' } ], onChange: function( value ) { set( { spreadReadingMode: value === 'pageFocus' ? 'pageFocus' : 'overview' } ); } } ) : null
						) : null ),
					el( PanelBody, { title: __( 'Panel reading mode', 'mangafocus' ), initialOpen: true },
						el( ToggleControl, { label: __( 'Enable panel reading mode', 'mangafocus' ), help: __( 'On: enlarge configured panels one at a time. Off: hide the panel reading launch button. Configure at least one panel to use this mode alone.', 'mangafocus' ), checked: reading.panel, onChange: function( value ) { setReadingMode( 'panel', value ); } } ),
						modeNotice && modeNotice.mode === 'panel' ? el( 'p', { role: 'alert' }, modeNotice.message ) : null,
						reading.panel ? el( element.Fragment, null,
							! hasPanelAreas( a ) ? el( 'p', { role: 'status' }, __( 'No panels are configured. Add panels before using panel reading alone.', 'mangafocus' ) ) : null,
							editorPanelSettings
						) : null ),
					el( PanelBody, { title: __( 'General settings', 'mangafocus' ), initialOpen: false },
						el( SelectControl, { label: __( 'Page layout', 'mangafocus' ), help: __( 'Used for inline and fullscreen paged reading.', 'mangafocus' ), value: [ 'spread', 'auto' ].indexOf( a.pageLayout ) !== -1 ? a.pageLayout : 'single', options: [ { label: __( 'Single page', 'mangafocus' ), value: 'single' }, { label: spreadUnavailable ? __( 'Spread (unavailable)', 'mangafocus' ) : __( 'Spread', 'mangafocus' ), value: 'spread', disabled: spreadUnavailable }, { label: spreadUnavailable ? __( 'Automatic (unavailable)', 'mangafocus' ) : __( 'Automatic', 'mangafocus' ), value: 'auto', disabled: spreadUnavailable } ], onChange: function( value ) { if ( spreadUnavailable && value !== 'single' ) return; set( { pageLayout: [ 'spread', 'auto' ].indexOf( value ) !== -1 ? value : 'single' } ); } } ),
						pages.length > 1 && [ 'spread', 'auto' ].indexOf( a.pageLayout ) !== -1 ? el( ToggleControl, { label: __( 'Show the first page separately', 'mangafocus' ), help: __( 'In spread view, display the first page on its own.', 'mangafocus' ), checked: a.singleFirstPage !== false, onChange: function( value ) { set( { singleFirstPage: !! value } ); } } ) : null,
						spreadAnalysis.status === 'pending' ? el( 'p', { className: 'description' }, __( 'Checking image information. Spread and automatic layouts remain available while checking.', 'mangafocus' ) ) : spreadUnavailable ? el( 'p', { className: 'description' }, __( 'The current page set has no pages that can be paired as a spread. Landscape pages and other unmatched pages are shown separately.', 'mangafocus' ) ) : el( 'p', { className: 'description' }, ( spreadAnalysis.hasUnknown ? __( 'At least ', 'mangafocus' ) : '' ) + spreadAnalysis.pairCount + __( 'spread pair(s) will be created. Landscape and unmatched pages are shown separately.', 'mangafocus' ) ),
						el( SelectControl, { label: __( 'Binding direction', 'mangafocus' ), help: __( 'Used for page and panel navigation. Vertical reading scrolls from top to bottom.', 'mangafocus' ), value: a.binding === 'ltr' ? 'ltr' : 'rtl', options: [ { label: __( 'Right binding (manga)', 'mangafocus' ), value: 'rtl' }, { label: __( 'Left binding', 'mangafocus' ), value: 'ltr' } ], onChange: function( value ) { set( { binding: value === 'ltr' ? 'ltr' : 'rtl' } ); } } ),
						el( RangeControl, { label: __( 'Maximum comic width (px)', 'mangafocus' ), help: __( 'Sets the inline maximum width and the base width for fullscreen vertical reading.', 'mangafocus' ), value: maxWidth, min: 320, max: 1600, step: 10, onChange: function( value ) { set( { maxWidth: clamp( value || 650, 320, 1600 ) } ); } } ),
						el( ToggleControl, { label: __( 'Show page numbers', 'mangafocus' ), help: __( 'Used for inline and fullscreen reading. Panel reading has its own page counter.', 'mangafocus' ), checked: a.showPageNumbers !== false, onChange: function( value ) { set( { showPageNumbers: !! value } ); } } ),
						el( ToggleControl, { label: __( 'Navigate by clicking page edges', 'mangafocus' ), help: __( 'Used for inline and fullscreen paged reading.', 'mangafocus' ), checked: a.enableEdgeClick !== false, onChange: function( value ) { set( { enableEdgeClick: !! value } ); } } ),
						el( ToggleControl, { label: __( 'Show navigation arrows on every page', 'mangafocus' ), help: __( 'Arrows require page-edge navigation to be enabled.', 'mangafocus' ) + ' ' + __( 'Off: first page only. On: every page.', 'mangafocus' ) + ' ' + __( 'In inline display, arrows use available side space or move below the image without reducing its width.', 'mangafocus' ) + ' ' + __( 'Used for inline and fullscreen paged reading.', 'mangafocus' ), checked: !! a.showGuideArrowOnAllPages, onChange: function( value ) { set( { showGuideArrowOnAllPages: !! value } ); } } ),
						el( ToggleControl, { label: __( 'Page transition animation', 'mangafocus' ), help: __( 'The page-turn animation applies to single-page navigation. Spread navigation and vertical scrolling do not use it.', 'mangafocus' ) + ' ' + __( 'Panel reading also uses this setting when moving between pages.', 'mangafocus' ), checked: a.enableAnimation !== false, onChange: function( value ) { set( { enableAnimation: !! value } ); } } ),
						el( ToggleControl, { label: __( 'Enable free zoom and pan', 'mangafocus' ), help: __( 'Readers can zoom with the plus and minus controls or pinch gestures, then drag the enlarged image.', 'mangafocus' ) + ' ' + __( 'Used for inline and fullscreen reading. Panel magnification is configured separately.', 'mangafocus' ), checked: !! a.enableZoom, onChange: function( value ) { set( { enableZoom: !! value } ); } } ),
						a.enableZoom ? el( SelectControl, { label: __( 'Zoom control position', 'mangafocus' ), help: __( 'Used for inline and fullscreen reading. Panel magnification is configured separately.', 'mangafocus' ), value: [ 'bottom', 'right', 'left' ].indexOf( a.zoomControlsPosition ) !== -1 ? a.zoomControlsPosition : 'bottom', options: [ { label: __( 'Bottom (horizontal)', 'mangafocus' ), value: 'bottom' }, { label: __( 'Right (vertical)', 'mangafocus' ), value: 'right' }, { label: __( 'Left (vertical)', 'mangafocus' ), value: 'left' } ], onChange: function( value ) { set( { zoomControlsPosition: [ 'right', 'left' ].indexOf( value ) !== -1 ? value : 'bottom' } ); } } ) : null
					),
					editorInspectorExtensions
				),
				el( 'div', blockProps, ! pages.length ? el( 'div', { className: 'amv-reader__placeholder' }, mediaSelect, el( 'p', null, __( 'Select one or more comic pages.', 'mangafocus' ) ) ) : el( element.Fragment, null, ! reading.inline ? el( 'div', { className: 'amv-reader__cover-launcher amv-reader__cover-launcher--editor' }, editedCover && editedCover.id && ! editedCover.url ? el( 'p', null, __( 'Cover selected. Its preview is loading or unavailable.', 'mangafocus' ) ) : el( 'img', { className: 'amv-reader__cover-image', src: editedCover && editedCover.id ? editedCover.url : pages[ 0 ].url, alt: editedCover && editedCover.id ? '' : pages[ 0 ].alt || '' } ), el( 'div', { className: 'amv-reader__cover-actions' }, reading.fullscreen ? el( 'span', { className: 'amv-reader__cover-launcher-button' }, __( 'Read manga', 'mangafocus' ) ) : null, reading.panel ? el( 'span', { className: 'amv-reader__cover-focus-open' }, __( 'Read by panel', 'mangafocus' ) ) : null ), el( 'small', null, __( 'Published display preview', 'mangafocus' ) ) ) : null, ! reading.inline ? el( 'p', { className: 'amv-reader__editor-preview-label' }, __( 'Comic editing preview', 'mangafocus' ) ) : null, el( 'div', { className: 'amv-reader__editor-stage' }, el( 'img', { src: page.url, alt: page.alt || '', draggable: false, onLoad: function( event ) { rememberDimensions( page, current, event.currentTarget ); } } ), editorStageExtensions, a.enableZoom && zoomPosition !== 'bottom' ? zoomPreview( 'amv-reader__zoom-controls--side' ) : null ), el( 'div', { className: 'amv-reader__editor-controls' }, el( Button, { variant: 'secondary', disabled: current === pages.length - 1, onClick: function() { setCurrent( current + 1 ); } }, __( 'Next page', 'mangafocus' ) ), a.showPageNumbers !== false ? el( 'span', null, ( current + 1 ) + ' / ' + pages.length ) : null, a.enableZoom && zoomPosition === 'bottom' ? zoomPreview( 'amv-reader__zoom-controls--bottom' ) : null, el( Button, { variant: 'secondary', disabled: current === 0, onClick: function() { setCurrent( current - 1 ); } }, __( 'Previous page', 'mangafocus' ) ) ) ), editorAuxiliaryExtensions )
			);
		}, save: function() { return null; }
	} );
} )( window.wp.blocks, window.wp.element, window.wp.blockEditor, window.wp.components, window.wp.i18n, window.wp.data, window.wp.apiFetch );
