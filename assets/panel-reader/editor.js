( function( wp ) {
	'use strict';
	const capabilities = window.aiMangaViewerCapabilities;
	const panelCapability = capabilities && capabilities.panel_reader;
	const editorAllowed = !! panelCapability && panelCapability.editor === true;
	if ( ! editorAllowed ) return;
	const el = wp.element.createElement;
	const { __ } = wp.i18n;
	const { Button, PanelBody, RangeControl, SelectControl, ToggleControl } = wp.components;
	const editorStates = new Map();

	function clamp( value, min, max ) { return Math.max( min, Math.min( max, typeof value === 'number' ? value : min ) ); }
	function areaId() { return 'focus-' + Date.now().toString( 36 ) + '-' + Math.random().toString( 36 ).slice( 2, 7 ); }
	function areasOf( page, mobile ) { const key = mobile ? 'mobileFocusAreas' : 'focusAreas'; return Array.isArray( page && page[ key ] ) ? page[ key ] : []; }
	function areaStyle( area ) { return { left: ( area.x - area.width / 2 ) + '%', top: ( area.y - area.height / 2 ) + '%', width: area.width + '%', height: area.height + '%' }; }
	function stateFor( clientId ) {
		if ( ! editorStates.has( clientId ) ) editorStates.set( clientId, { editingMobile: false, selectedId: '', drawing: false, draft: null, listeners: new Set() } );
		return editorStates.get( clientId );
	}
	function changeState( clientId, values ) { const state = stateFor( clientId ); Object.assign( state, values ); state.listeners.forEach( function( listener ) { listener(); } ); }
	function useEditorState( context ) {
		const force = wp.element.useState( 0 )[ 1];
		wp.element.useEffect( function() { const state = stateFor( context.clientId ); const listener = function() { force( function( value ) { return value + 1; } ); }; state.listeners.add( listener ); return function() { state.listeners.delete( listener ); }; }, [ context.clientId ] );
		return stateFor( context.clientId );
	}
	function updatePageAreas( context, mobile, nextAreas ) { const values = {}; values[ mobile ? 'mobileFocusAreas' : 'focusAreas' ] = nextAreas; context.updateCurrentPage( values ); }
	function setReaderEnabled( context, value ) {
		context.setAttributes( { focusReader: !! value } );
		return true;
	}

	function Inspector( props ) {
		const context = props.context; const attributes = context.attributes; const page = context.currentPage; const state = useEditorState( context );
		const editingMobile = !! attributes.mobileFocusReader && state.editingMobile; const areas = areasOf( page, editingMobile ); const selected = areas.find( function( area ) { return area.id === state.selectedId; } ) || null;
		function setAreas( nextAreas ) { updatePageAreas( context, editingMobile, nextAreas ); }
		function updateArea( id, values ) { setAreas( areas.map( function( area ) { return area.id === id ? Object.assign( {}, area, values ) : area; } ) ); }
		function moveArea( from, to ) { if ( to < 0 || to >= areas.length || from === to ) return; const next = areas.slice(); next.splice( to, 0, next.splice( from, 1 )[ 0 ] ); setAreas( next ); }
		return el( wp.element.Fragment, null,
			el( PanelBody, { title: __( 'Panel-by-Panel', 'mangafocus' ), initialOpen: !! attributes.focusReader },
				el( ToggleControl, { label: __( 'Enable Panel-by-Panel reading', 'mangafocus' ), help: __( 'Enlarge registered panels in sequence in a dedicated viewer.', 'mangafocus' ), checked: !! attributes.focusReader, onChange: function( value ) { setReaderEnabled( context, !! value ); } } ),
				attributes.focusReader ? el( ToggleControl, { label: __( 'Configure mobile panels separately', 'mangafocus' ), help: __( 'When enabled, desktop panels are used as the initial values and you can adjust mobile regions and order separately.', 'mangafocus' ), checked: !! attributes.mobileFocusReader, onChange: function( value ) { const enabled = !! value; const pages = Array.isArray( attributes.pages ) ? attributes.pages : []; context.setAttributes( { mobileFocusReader: enabled, pages: enabled ? pages.map( function( item ) { return Array.isArray( item.mobileFocusAreas ) ? item : Object.assign( {}, item, { mobileFocusAreas: areasOf( item ) } ); } ) : pages } ); if ( ! enabled ) changeState( context.clientId, { editingMobile: false } ); } } ) : null,
				attributes.focusReader && attributes.mobileFocusReader ? el( SelectControl, { label: __( 'Panel set to edit', 'mangafocus' ), value: editingMobile ? 'mobile' : 'pc', options: [ { label: __( 'PC', 'mangafocus' ), value: 'pc' }, { label: __( 'Mobile', 'mangafocus' ), value: 'mobile' } ], onChange: function( value ) { changeState( context.clientId, { editingMobile: value === 'mobile', selectedId: '', drawing: false, draft: null } ); } } ) : null,
				attributes.focusReader && page ? el( wp.element.Fragment, null,
					el( Button, { variant: state.drawing ? 'primary' : 'secondary', onClick: function() { changeState( context.clientId, { drawing: ! state.drawing, selectedId: '', draft: null } ); } }, state.drawing ? __( 'Drag over the image to create a region', 'mangafocus' ) : ( editingMobile ? __( 'Add a mobile panel', 'mangafocus' ) : __( 'Add a panel to the current page', 'mangafocus' ) ) ),
					areas.length ? el( 'div', { className: 'amv-reader__focus-list' }, areas.map( function( area, index ) { return el( 'div', { key: area.id, className: 'amv-reader__focus-item' + ( state.selectedId === area.id ? ' is-selected' : '' ) }, el( Button, { variant: state.selectedId === area.id ? 'primary' : 'tertiary', onClick: function() { changeState( context.clientId, { selectedId: area.id, drawing: false, draft: null } ); } }, ( index + 1 ) + '. ' + __( 'Panel', 'mangafocus' ) ), el( Button, { icon: 'arrow-up-alt2', label: __( 'Previous', 'mangafocus' ), disabled: index === 0, onClick: function() { moveArea( index, index - 1 ); } } ), el( Button, { icon: 'arrow-down-alt2', label: __( 'Next', 'mangafocus' ), disabled: index === areas.length - 1, onClick: function() { moveArea( index, index + 1 ); } } ), el( Button, { icon: 'trash', label: __( 'Delete', 'mangafocus' ), isDestructive: true, onClick: function() { setAreas( areas.filter( function( value ) { return value.id !== area.id; } ) ); changeState( context.clientId, { selectedId: '' } ); } } ) ); } ) ) : el( 'p', { className: 'description' }, __( 'Select “Add panel,” then drag over the image.', 'mangafocus' ) ),
					selected ? el( wp.element.Fragment, null,
						el( SelectControl, { label: __( 'Display method', 'mangafocus' ), value: selected.view || 'auto', options: [ { label: __( 'Automatic (fit to panel size)', 'mangafocus' ), value: 'auto' }, { label: __( 'Enlarge', 'mangafocus' ), value: 'focus' }, { label: __( 'Show full page', 'mangafocus' ), value: 'overview' } ], onChange: function( value ) { updateArea( selected.id, { view: value } ); } } ),
						el( RangeControl, { label: __( 'Zoom level (%)', 'mangafocus' ), help: __( 'Lower this value if small panels are enlarged too much.', 'mangafocus' ), value: typeof selected.zoom === 'number' ? selected.zoom : 100, min: 60, max: 110, step: 5, onChange: function( value ) { updateArea( selected.id, { zoom: clamp( value || 100, 60, 110 ) } ); } } ),
						[ [ 'X（%）', 'x', 0, 100 ], [ 'Y（%）', 'y', 0, 100 ], [ __( 'Width (%)', 'mangafocus' ), 'width', 5, 100 ], [ __( 'Height (%)', 'mangafocus' ), 'height', 5, 100 ] ].map( function( field ) { return el( RangeControl, { key: field[ 1 ], label: field[ 0 ], value: selected[ field[ 1 ] ], min: field[ 2 ], max: field[ 3 ], onChange: function( value ) { const update = {}; update[ field[ 1 ] ] = clamp( value, field[ 2 ], field[ 3 ] ); updateArea( selected.id, update ); } } ); } )
					) : null
				) : null
			),
			attributes.focusReader ? el( PanelBody, { title: __( 'Dedicated viewer start position', 'mangafocus' ), initialOpen: false }, el( ToggleControl, { label: __( 'Start from the current page', 'mangafocus' ), help: __( 'When disabled, the dedicated viewer starts from the beginning regardless of the page currently open.', 'mangafocus' ), checked: !! attributes.focusReaderStartAtCurrent, onChange: function( value ) { context.setAttributes( { focusReaderStartAtCurrent: !! value } ); } } ) ) : null
		);
	}

	function StageOverlay( props ) {
		const context = props.context; const page = context.currentPage; const state = useEditorState( context ); const interaction = wp.element.useRef( null );
		if ( ! context.attributes.focusReader || ! page ) return null;
		const editingMobile = !! context.attributes.mobileFocusReader && state.editingMobile; const areas = areasOf( page, editingMobile );
		function setAreas( nextAreas ) { updatePageAreas( context, editingMobile, nextAreas ); }
		function updateArea( id, values ) { setAreas( areas.map( function( area ) { return area.id === id ? Object.assign( {}, area, values ) : area; } ) ); }
		function point( event ) { const layer = event.currentTarget.classList.contains( 'amv-panel-editor-layer' ) ? event.currentTarget : event.currentTarget.closest( '.amv-panel-editor-layer' ); const rect = layer.getBoundingClientRect(); return { x: clamp( ( event.clientX - rect.left ) / rect.width * 100, 0, 100 ), y: clamp( ( event.clientY - rect.top ) / rect.height * 100, 0, 100 ) }; }
		function stop( event ) { event.preventDefault(); event.stopPropagation(); if ( event.nativeEvent && event.nativeEvent.stopImmediatePropagation ) event.nativeEvent.stopImmediatePropagation(); }
		function downStage( event ) { if ( ! state.drawing ) return; stop( event ); const start = point( event ); interaction.current = { type: 'create', start: start, draft: { x: start.x, y: start.y, width: 0, height: 0 } }; changeState( context.clientId, { draft: interaction.current.draft } ); event.currentTarget.setPointerCapture && event.currentTarget.setPointerCapture( event.pointerId ); }
		function downArea( event, area, resize ) { stop( event ); interaction.current = { type: resize ? 'resize' : 'move', id: area.id, start: point( event ), area: Object.assign( {}, area ) }; changeState( context.clientId, { selectedId: area.id, drawing: false, draft: null } ); event.currentTarget.setPointerCapture && event.currentTarget.setPointerCapture( event.pointerId ); }
		function move( event ) { const active = interaction.current; if ( ! active ) return; stop( event ); const current = point( event ); if ( active.type === 'create' ) { const x1 = Math.min( active.start.x, current.x ), y1 = Math.min( active.start.y, current.y ), x2 = Math.max( active.start.x, current.x ), y2 = Math.max( active.start.y, current.y ); active.draft = { x: ( x1 + x2 ) / 2, y: ( y1 + y2 ) / 2, width: x2 - x1, height: y2 - y1 }; changeState( context.clientId, { draft: active.draft } ); return; } const relative = { x: current.x - active.start.x, y: current.y - active.start.y }; if ( active.type === 'move' ) updateArea( active.id, { x: clamp( active.area.x + relative.x, 0, 100 ), y: clamp( active.area.y + relative.y, 0, 100 ) } ); else updateArea( active.id, { width: clamp( active.area.width + relative.x * 2, 5, 100 ), height: clamp( active.area.height + relative.y * 2, 5, 100 ) } ); }
		function up( event ) { const active = interaction.current; if ( ! active ) return; stop( event ); interaction.current = null; if ( active.type === 'create' && active.draft && active.draft.width >= 4 && active.draft.height >= 4 ) { const area = { id: areaId(), x: active.draft.x, y: active.draft.y, width: Math.max( 5, active.draft.width ), height: Math.max( 5, active.draft.height ), view: 'auto', zoom: 100 }; setAreas( areas.concat( area ) ); changeState( context.clientId, { selectedId: area.id, drawing: false, draft: null } ); } else changeState( context.clientId, { drawing: false, draft: null } ); if ( event.currentTarget.releasePointerCapture && event.currentTarget.hasPointerCapture && event.currentTarget.hasPointerCapture( event.pointerId ) ) event.currentTarget.releasePointerCapture( event.pointerId ); }
		return el( 'div', { className: 'amv-panel-editor-layer' + ( state.drawing ? ' is-drawing' : '' ), onPointerDown: downStage, onPointerMove: move, onPointerUp: up, onPointerCancel: up },
			areas.map( function( area, index ) { return el( 'div', { key: area.id, className: 'amv-reader__focus-area' + ( state.selectedId === area.id ? ' is-selected' : '' ), style: areaStyle( area ), onPointerDown: function( event ) { downArea( event, area, false ); } }, el( 'span', null, index + 1 ), state.selectedId === area.id ? el( 'button', { type: 'button', className: 'amv-reader__focus-resize', onPointerDown: function( event ) { downArea( event, area, true ); }, 'aria-label': __( 'Enlarge the panel region', 'mangafocus' ) } ) : null ); } ),
			state.draft && state.draft.width > 0 && state.draft.height > 0 ? el( 'div', { className: 'amv-reader__focus-area is-draft', style: areaStyle( state.draft ) } ) : null
		);
	}

	wp.hooks.addFilter( 'aiMangaViewer.editor.inspectorPanels', 'mangafocus/panel-reader-inspector', function( items, context ) { if ( ! context.currentPage ) return items; return items.concat( el( Inspector, { key: 'mangafocus-panel-reader-inspector', context: context } ) ); } );
	wp.hooks.addFilter( 'aiMangaViewer.editor.stageOverlays', 'mangafocus/panel-reader-stage', function( items, context ) { if ( ! context.currentPage ) return items; return items.concat( el( StageOverlay, { key: 'mangafocus-panel-reader-stage', context: context } ) ); } );
} )( window.wp );
