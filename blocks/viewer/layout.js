( function( window ) {
	'use strict';

	const LANDSCAPE_RATIO = 1.18;

	function dimensionState( dimensions ) {
		const width = Number( dimensions && dimensions.width ) || 0;
		const height = Number( dimensions && dimensions.height ) || 0;
		if ( width <= 0 || height <= 0 ) return 'unknown';
		return width / height >= LANDSCAPE_RATIO ? 'landscape' : 'portrait';
	}

	function buildViews( pageCount, singleFirstPage, isLandscape ) {
		const result = [];
		let index = 0;
		if ( singleFirstPage && pageCount ) {
			result.push( [ 0 ] );
			index = 1;
		}
		while ( index < pageCount ) {
			if ( isLandscape( index ) ) {
				result.push( [ index ] );
				index += 1;
				continue;
			}
			if ( index + 1 < pageCount && ! isLandscape( index + 1 ) ) {
				result.push( [ index, index + 1 ] );
				index += 2;
				continue;
			}
			result.push( [ index ] );
			index += 1;
		}
		return result;
	}

	function pairCount( pageStates, singleFirstPage, unknownIsLandscape ) {
		return buildViews( pageStates.length, singleFirstPage, function( index ) {
			return pageStates[ index ] === 'landscape' || ( unknownIsLandscape && pageStates[ index ] === 'unknown' );
		} ).filter( function( view ) { return view.length === 2; } ).length;
	}

	function analyzePages( dimensions, singleFirstPage ) {
		const states = dimensions.map( dimensionState );
		const possiblePairs = pairCount( states, singleFirstPage, false );
		const conservativePairs = pairCount( states, singleFirstPage, true );
		const hasUnknown = states.indexOf( 'unknown' ) !== -1;
		if ( conservativePairs > 0 ) return { status: 'available', pairCount: conservativePairs, hasUnknown: hasUnknown };
		if ( hasUnknown && possiblePairs > 0 ) return { status: 'pending', pairCount: possiblePairs, hasUnknown: true };
		return { status: possiblePairs > 0 ? 'available' : 'unavailable', pairCount: possiblePairs, hasUnknown: hasUnknown };
	}

	window.aiMangaViewerLayout = {
		landscapeRatio: LANDSCAPE_RATIO,
		dimensionState: dimensionState,
		buildViews: buildViews,
		analyzePages: analyzePages
	};
} )( window );
