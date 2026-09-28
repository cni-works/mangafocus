(function () {
	'use strict';
	document.addEventListener('click', function (event) {
		var button = event.target.closest && event.target.closest('[data-amv-copy-consultation]');
		if (!button) return;
		var output = document.querySelector('[data-amv-consultation-markdown]');
		var status = document.querySelector('[data-amv-consultation-status]');
		if (!output) return;
		function copied() {
			button.textContent = button.dataset.copiedLabel;
			if (status) status.textContent = 'AI相談資料をコピーしました。';
			window.setTimeout(function () { button.textContent = button.dataset.defaultLabel; }, 1600);
		}
		if (navigator.clipboard && window.isSecureContext) {
			navigator.clipboard.writeText(output.value).then(copied).catch(function () { output.focus(); output.select(); if (status) status.textContent = 'コピーできませんでした。選択した内容を手動でコピーしてください。'; });
			return;
		}
		output.focus(); output.select();
		if (document.execCommand('copy')) copied();
		else if (status) status.textContent = 'コピーできませんでした。選択した内容を手動でコピーしてください。';
	});
}());
