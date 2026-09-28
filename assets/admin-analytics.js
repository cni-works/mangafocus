(function () {
	'use strict';
	document.querySelectorAll('[data-amv-report-chart]').forEach(function (chart) {
		var panel = chart.closest('.amv-panel');
		var dateOutput = panel ? panel.querySelector('[data-amv-chart-date]') : null;
		var valueOutput = panel ? panel.querySelector('[data-amv-chart-values]') : null;
		var metricButtons = panel ? panel.querySelectorAll('[data-amv-metric]') : [];
		var topAxis = chart.querySelector('[data-amv-axis-top]');
		var middleAxis = chart.querySelector('[data-amv-axis-middle]');
		var labels = {
			sessions: { name: '読書開始', unit: '回' },
			readers: { name: '読者数', unit: '人' }
		};

		function dataName(metric) {
			return 'amv' + metric.charAt(0).toUpperCase() + metric.slice(1);
		}

		function selectDay(day) {
			if (!dateOutput || !valueOutput || !day) return;
			chart.querySelectorAll('.amv-chart-day[aria-pressed="true"]').forEach(function (selected) {
				selected.setAttribute('aria-pressed', 'false');
			});
			day.setAttribute('aria-pressed', 'true');
			var metric = chart.dataset.amvMetric || 'sessions';
			dateOutput.textContent = day.dataset.amvDay || '';
			valueOutput.textContent = labels[metric].name + ' ' + (day.dataset[dataName(metric)] || '0') + labels[metric].unit;
		}

		function setMetric(metric) {
			if (!labels[metric]) return;
			chart.dataset.amvMetric = metric;
			var maximum = Number(chart.dataset['amvMax' + metric.charAt(0).toUpperCase() + metric.slice(1)]) || 1;
			metricButtons.forEach(function (button) {
				var active = button.dataset.amvMetric === metric;
				button.classList.toggle('is-active', active);
				button.setAttribute('aria-pressed', active ? 'true' : 'false');
			});
			if (topAxis) topAxis.textContent = String(maximum);
			if (middleAxis) middleAxis.textContent = String(Math.ceil(maximum / 2));
			chart.querySelectorAll('.amv-chart-day').forEach(function (day) {
				var value = Number(day.dataset[dataName(metric)]) || 0;
				var bar = day.querySelector('.amv-chart-bar');
				if (bar) bar.style.height = String(value * 100 / maximum) + '%';
				day.setAttribute('aria-label', (day.dataset.amvDay || '') + '、' + labels[metric].name + value + labels[metric].unit);
			});
			var selected = chart.querySelector('.amv-chart-day[aria-pressed="true"]');
			if (selected) selectDay(selected);
			else if (valueOutput) valueOutput.textContent = '棒をクリックすると' + labels[metric].name + 'を表示します。';
		}

		chart.addEventListener('click', function (event) {
			var day = event.target.closest('.amv-chart-day');
			if (day && chart.contains(day)) selectDay(day);
		});
		metricButtons.forEach(function (button) {
			button.addEventListener('click', function () { setMetric(button.dataset.amvMetric); });
		});
		setMetric('sessions');
	});
}());
