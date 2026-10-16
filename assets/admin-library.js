( function() {
	'use strict';

	function copyText( text ) {
		if ( navigator.clipboard && window.isSecureContext ) {
			return navigator.clipboard.writeText( text );
		}
		const input = document.createElement( 'textarea' );
		input.value = text;
		input.setAttribute( 'readonly', '' );
		input.style.position = 'fixed';
		input.style.opacity = '0';
		document.body.appendChild( input );
		input.select();
		input.setSelectionRange( 0, input.value.length );
		const copied = document.execCommand( 'copy' );
		input.remove();
		return copied ? Promise.resolve() : Promise.reject();
	}

	document.addEventListener( 'click', function( event ) {
		const button = event.target.closest && event.target.closest( '.amv-library-shortcode__copy' );
		if ( ! button ) return;
		const wrapper = button.closest( '.amv-library-shortcode' );
		const feedback = button.querySelector( '.amv-library-shortcode__feedback' );
		const status = wrapper && wrapper.querySelector( '.amv-library-shortcode__status' );
		const shortcode = button.dataset.shortcode;
		if ( ! shortcode ) return;

		copyText( shortcode ).then( function() {
			if ( feedback ) feedback.textContent = button.dataset.copiedLabel;
			if ( status ) status.textContent = button.dataset.successMessage;
			window.setTimeout( function() {
				if ( feedback ) feedback.textContent = button.dataset.defaultLabel;
			}, 1600 );
		} ).catch( function() {
			if ( status ) status.textContent = button.dataset.errorMessage;
		} );
	} );
} )();
