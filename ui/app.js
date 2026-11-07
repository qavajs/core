(() => {
    'use strict';

    // ---------- icons ----------
    const svg = (body, viewBox = '0 0 16 16') => `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
    const ICONS = {
        run: svg('<path d="M4.5 2.8v10.4L13 8z" fill="currentColor" stroke="none"/>'),
        stop: svg('<rect x="3.5" y="3.5" width="9" height="9" rx="1.5" fill="currentColor" stroke="none"/>'),
        reload: svg('<path d="M13 8a5 5 0 1 1-1.5-3.6M13 2.5v3h-3"/>'),
        chevron: svg('<path d="M4 6l4 4 4-4"/>'),
        passed: svg('<circle cx="8" cy="8" r="6.5"/><path d="M5.2 8.2l2 2 3.6-4"/>'),
        failed: svg('<circle cx="8" cy="8" r="6.5"/><path d="M5.7 5.7l4.6 4.6M10.3 5.7l-4.6 4.6"/>'),
        skipped: svg('<circle cx="8" cy="8" r="6.5"/><path d="M5 8h6"/>'),
        pending: svg('<circle cx="8" cy="8" r="6.5"/><path d="M8 4.8V8l2 1.5"/>'),
        undefined: svg('<circle cx="8" cy="8" r="6.5"/><path d="M6.3 6.3a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1M8 11.2v.1"/>'),
        ambiguous: svg('<circle cx="8" cy="8" r="6.5"/><path d="M8 4.8v3.8M8 11.2v.1"/>'),
        interrupted: svg('<circle cx="8" cy="8" r="6.5"/><path d="M6.3 5.5v5M9.7 5.5v5"/>'),
        running: svg('<path d="M8 1.5a6.5 6.5 0 1 0 6.5 6.5" />'),
        queued: svg('<circle cx="8" cy="8" r="6.5" stroke-dasharray="2.5 2.2"/>'),
        idle: svg('<circle cx="8" cy="8" r="6.5"/>'),
    };
    const STATUS_LABEL = {
        passed: 'Passed', failed: 'Failed', skipped: 'Skipped', pending: 'Pending', undefined: 'Undefined',
        ambiguous: 'Ambiguous', interrupted: 'Interrupted', running: 'Running', queued: 'Queued', idle: 'Not run'
    };
    const statusIcon = (status) => `<span class="status ${status}" title="${STATUS_LABEL[status] ?? status}">${ICONS[status] ?? ICONS.idle}</span>`;

    // ---------- helpers ----------
    const $ = (selector) => document.querySelector(selector);
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
    const formatDuration = (ms) => {
        if (ms === undefined || ms === null) return '';
        if (ms < 1000) return `${Math.round(ms)}ms`;
        if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
        return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
    };
    const formatSize = (bytes) => bytes < 1024 ? `${bytes} B` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;
    const storage = {
        get(key, fallback) {
            try { return JSON.parse(localStorage.getItem(`qavajs-ui:${key}`)) ?? fallback; } catch { return fallback; }
        },
        set(key, value) {
            try { localStorage.setItem(`qavajs-ui:${key}`, JSON.stringify(value)); } catch { /* storage unavailable */ }
        }
    };
    async function api(path, body) {
        const response = await fetch(path, {
            method: body === undefined ? 'GET' : 'POST',
            headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? response.statusText);
        return data;
    }

    // ---------- state ----------
    const state = {
        tree: [],
        tests: new Map(),
        run: { state: 'idle', testIds: [] },
        output: [],
        error: null,
        selected: storage.get('selected', null),
        collapsed: new Set(storage.get('collapsed', [])),
        filter: storage.get('filter', ''),
        statusFilter: storage.get('statusFilter', 'all'),
        tab: storage.get('tab', 'steps'),
        sources: new Map(),
        connected: false
    };

    // ---------- filtering ----------
    const STATUS_GROUPS = {
        all: null,
        failed: ['failed', 'interrupted', 'ambiguous', 'undefined'],
        passed: ['passed'],
        skipped: ['skipped', 'pending'],
        idle: ['idle', 'queued']
    };

    function matchesFilter(test) {
        const statuses = STATUS_GROUPS[state.statusFilter];
        if (statuses && !statuses.includes(test.status)) return false;
        const tokens = state.filter.toLowerCase().split(/\s+/).filter(Boolean);
        if (tokens.length === 0) return true;
        const haystack = [test.feature, test.rule, test.outline, test.name, `${test.uri}:${test.line}`].join(' ').toLowerCase();
        const tags = test.tags.map((tag) => tag.toLowerCase());
        return tokens.every((token) => token.startsWith('@')
            ? tags.some((tag) => tag.startsWith(token))
            : haystack.includes(token));
    }

    const isFiltering = () => state.filter.trim() !== '' || state.statusFilter !== 'all';

    /** ids of visible tests under node */
    function visibleTestIds(node) {
        if (node.kind === 'test') {
            const test = state.tests.get(node.id);
            return test && matchesFilter(test) ? [node.id] : [];
        }
        return node.children.flatMap(visibleTestIds);
    }

    function aggregateStatus(ids) {
        const statuses = ids.map((id) => state.tests.get(id)?.status ?? 'idle');
        for (const status of ['running', 'failed', 'interrupted', 'ambiguous', 'undefined', 'queued', 'pending']) {
            if (statuses.includes(status)) return status;
        }
        if (statuses.length > 0 && statuses.every((status) => status === 'passed' || status === 'skipped')) {
            return statuses.includes('passed') ? 'passed' : 'skipped';
        }
        return 'idle';
    }

    // ---------- actions ----------
    const isBusy = () => state.run.state !== 'idle';

    async function runTests(ids) {
        if (isBusy()) return;
        try {
            await api('/api/run', { ids });
        } catch (err) {
            showToast(err.message);
        }
    }

    function runAllVisible() {
        if (!isFiltering()) return runTests(undefined);
        const ids = state.tree.flatMap(visibleTestIds);
        if (ids.length) runTests(ids);
    }

    function select(id) {
        state.selected = id;
        storage.set('selected', id);
        scheduleRender();
    }

    function toggle(id) {
        if (state.collapsed.has(id)) state.collapsed.delete(id); else state.collapsed.add(id);
        storage.set('collapsed', [...state.collapsed]);
        scheduleRender();
    }

    let toastTimer;
    function showToast(message) {
        const banner = $('#banner');
        banner.hidden = false;
        banner.textContent = message;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => renderBanner(), 4000);
    }

    // ---------- render: sidebar ----------
    let renderScheduled = false;
    function scheduleRender() {
        if (renderScheduled) return;
        renderScheduled = true;
        requestAnimationFrame(() => {
            renderScheduled = false;
            render();
        });
    }

    function renderToolbar() {
        const busy = isBusy();
        const runBtn = $('#btn-run');
        runBtn.disabled = busy || state.tree.length === 0 || !state.connected;
        runBtn.title = isFiltering() ? 'Run visible tests' : 'Run all tests';
        $('#btn-stop').disabled = state.run.state !== 'running';
        $('#btn-reload').disabled = busy || !state.connected;

        const progress = $('#progress');
        const total = state.run.testIds.length;
        if (state.run.state === 'running' && total > 0) {
            const done = state.run.testIds.filter((id) => !['queued', 'running'].includes(state.tests.get(id)?.status)).length;
            progress.classList.remove('done');
            progress.firstElementChild.style.width = `${Math.max(2, (done / total) * 100)}%`;
        } else if (state.run.state === 'discovering') {
            progress.classList.remove('done');
            progress.firstElementChild.style.width = '30%';
        } else {
            progress.classList.add('done');
            progress.firstElementChild.style.width = '100%';
        }
        for (const chip of document.querySelectorAll('#status-filter button')) {
            chip.setAttribute('aria-checked', String(chip.dataset.status === state.statusFilter));
        }
    }

    function renderTree() {
        const container = $('#tree');
        if (state.tree.length === 0) {
            container.innerHTML = `<div class="empty">${
                !state.connected ? 'Connecting…' : state.run.state === 'discovering' ? 'Loading tests…' : 'No tests found'
            }</div>`;
            return;
        }
        const filtering = isFiltering();
        const rows = [];
        const visit = (node, depth) => {
            const ids = visibleTestIds(node);
            if (ids.length === 0) return;
            const isTest = node.kind === 'test';
            const test = isTest ? state.tests.get(node.id) : null;
            const collapsed = !isTest && !filtering && state.collapsed.has(node.id);
            const status = isTest ? test.status : aggregateStatus(ids);
            const duration = isTest ? test.duration : undefined;
            const name = node.name || (node.kind === 'feature' ? node.uri : '(unnamed)');
            rows.push(`
                <div class="row ${node.kind}${collapsed ? ' collapsed' : ''}${state.selected === node.id ? ' selected' : ''}"
                     data-id="${escapeHtml(node.id)}" data-kind="${node.kind}" tabindex="0" role="treeitem"
                     ${isTest ? '' : `aria-expanded="${!collapsed}"`}
                     style="padding-left:${8 + depth * 14}px" title="${escapeHtml(`${name}\n${node.uri}:${node.line}`)}">
                    <span class="chevron">${isTest ? '' : ICONS.chevron}</span>
                    ${statusIcon(status)}
                    <span class="name">${escapeHtml(name)}</span>
                    <span class="duration">${formatDuration(duration)}</span>
                    <button class="icon-btn run-btn" data-run="${escapeHtml(node.id)}" title="Run" ${isBusy() ? 'disabled' : ''}>${ICONS.run}</button>
                </div>`);
            if (!isTest && !collapsed) node.children.forEach((child) => visit(child, depth + 1));
        };
        state.tree.forEach((feature) => visit(feature, 0));
        container.innerHTML = rows.length ? rows.join('') : '<div class="empty">No tests match the filter</div>';
    }

    function renderSummary() {
        const counts = { passed: 0, failed: 0, skipped: 0, idle: 0 };
        for (const test of state.tests.values()) {
            if (test.status === 'passed') counts.passed++;
            else if (STATUS_GROUPS.failed.includes(test.status)) counts.failed++;
            else if (STATUS_GROUPS.skipped.includes(test.status)) counts.skipped++;
        }
        const { startedAt, finishedAt } = state.run;
        const duration = startedAt ? formatDuration((finishedAt && state.run.state === 'idle' ? finishedAt : Date.now()) - startedAt) : '';
        $('#summary').innerHTML = `
            <span class="stat" title="Passed">${statusIcon('passed')}${counts.passed}</span>
            <span class="stat" title="Failed">${statusIcon('failed')}${counts.failed}</span>
            <span class="stat" title="Skipped">${statusIcon('skipped')}${counts.skipped}</span>
            <span class="spacer"></span>
            <span>${state.tests.size} tests${duration ? ` · ${duration}` : ''}</span>`;
    }

    function renderBanner() {
        const banner = $('#banner');
        const message = state.error ?? (state.run.state === 'idle' ? state.run.error : null);
        banner.hidden = !message;
        banner.textContent = message ?? '';
    }

    // ---------- render: details ----------
    function findNode(id, nodes = state.tree, parents = []) {
        for (const node of nodes) {
            if (node.id === id) return { node, parents };
            if (node.children) {
                const found = findNode(id, node.children, [...parents, node]);
                if (found) return found;
            }
        }
        return null;
    }

    function renderDetails() {
        const details = $('#details');
        const found = state.selected ? findNode(state.selected) : null;
        if (!found) {
            details.innerHTML = '';
            return;
        }
        const { node, parents } = found;
        const test = node.kind === 'test' ? state.tests.get(node.id) : null;
        const ids = visibleTestIds(node);
        const status = test ? test.status : aggregateStatus(ids);
        const crumbs = parents.map((parent) => escapeHtml(parent.name || parent.uri)).join(' › ');
        const tags = test ? test.tags.map((tag) => `<span class="tag" data-tag="${escapeHtml(tag)}" title="Filter by tag">${escapeHtml(tag)}</span>`).join('') : '';
        const extra = test
            ? [test.duration !== undefined ? formatDuration(test.duration) : '', test.attempt > 0 ? `attempt ${test.attempt + 1}` : ''].filter(Boolean).join(' · ')
            : `${ids.length} test${ids.length === 1 ? '' : 's'}`;
        details.innerHTML = `
            ${crumbs ? `<div class="crumbs">${crumbs}</div>` : ''}
            <h1>${statusIcon(status)}<span>${escapeHtml(node.name || node.uri)}</span></h1>
            <div class="meta">
                <button class="btn" data-run="${escapeHtml(node.id)}" ${isBusy() || !ids.length ? 'disabled' : ''}>${ICONS.run} Run</button>
                <span class="location">${escapeHtml(node.uri)}:${node.line}</span>
                ${extra ? `<span>${escapeHtml(extra)}</span>` : ''}
                ${tags}
            </div>`;
    }

    function renderAttachment(attachment) {
        const url = `/api/attachments/${encodeURIComponent(attachment.id)}`;
        const title = `
            <div class="attachment-title">
                <span>${escapeHtml(attachment.fileName ?? attachment.mediaType)} · ${formatSize(attachment.size)}</span>
                <a href="${url}" target="_blank" rel="noopener">open</a>
                <a href="${url}?download">download</a>
            </div>`;
        if (attachment.mediaType === 'text/x.cucumber.log+plain') {
            return `<div class="attachment"><div class="attachment-text">${escapeHtml(attachment.text)}</div></div>`;
        }
        if (attachment.mediaType.startsWith('image/')) {
            return `<div class="attachment">${title}<a href="${url}" target="_blank" rel="noopener"><img src="${url}" alt="${escapeHtml(attachment.fileName ?? 'attachment')}" loading="lazy"></a></div>`;
        }
        if (attachment.mediaType.startsWith('video/')) {
            return `<div class="attachment">${title}<video src="${url}" controls preload="metadata"></video></div>`;
        }
        if (attachment.text !== undefined) {
            let text = attachment.text;
            if (attachment.mediaType === 'application/json') {
                try { text = JSON.stringify(JSON.parse(text), null, 2); } catch { /* keep raw */ }
            }
            return `<div class="attachment">${title}<div class="attachment-text">${escapeHtml(text)}</div></div>`;
        }
        return `<div class="attachment">${title}</div>`;
    }

    function renderStep(step) {
        const body = [];
        if (step.docString !== undefined) body.push(`<div class="doc-string">${escapeHtml(step.docString)}</div>`);
        if (step.dataTable) {
            body.push(`<table class="data-table">${step.dataTable.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</table>`);
        }
        if (step.error) body.push(`<div class="error">${ansiToHtml(step.error)}</div>`);
        body.push(...step.attachments.map(renderAttachment));
        const label = step.kind === 'hook'
            ? `<span class="keyword">${escapeHtml(step.keyword)} hook</span>${escapeHtml(step.text)}`
            : `<span class="keyword">${escapeHtml(step.keyword)}</span>${escapeHtml(step.text)}`;
        return `
            <li class="step ${step.kind}">
                <div class="step-head">
                    ${statusIcon(step.status)}
                    <span class="text">${label}</span>
                    <span class="duration">${formatDuration(step.duration)}</span>
                </div>
                ${body.length ? `<div class="step-body">${body.join('')}</div>` : ''}
            </li>`;
    }

    function renderSteps(panel) {
        const test = state.tests.get(state.selected);
        if (!test) {
            panel.innerHTML = `<div class="placeholder">${state.selected ? 'Select a scenario to see its steps' : 'Select a scenario in the tree'}</div>`;
            return;
        }
        // hide passed hooks without attachments: they are noise in most cases
        const steps = test.steps.filter((step) => step.kind === 'step' || step.error || step.attachments.length || !['passed', 'idle', 'queued', 'skipped'].includes(step.status));
        panel.innerHTML = `<ul class="steps">${steps.map(renderStep).join('')}</ul>`;
    }

    function highlightGherkin(line) {
        const escaped = escapeHtml(line);
        if (/^\s*#/.test(line)) return `<span class="comment">${escaped}</span>`;
        if (/^\s*@/.test(line)) return `<span class="tagged">${escaped}</span>`;
        return escaped
            .replace(/^(\s*)(Feature|Rule|Background|Scenario Outline|Scenario Template|Scenarios|Scenario|Examples|Example|Given|When|Then|And|But|\*)(:?)/, '$1<span class="kw">$2$3</span>')
            .replace(/(&quot;[^&]*?&quot;|&#39;[^&]*?&#39;)/g, '<span class="str">$1</span>');
    }

    function renderSource(panel) {
        const found = state.selected ? findNode(state.selected) : null;
        if (!found) {
            panel.innerHTML = '<div class="placeholder">Select a scenario in the tree</div>';
            return;
        }
        const { node } = found;
        const source = state.sources.get(node.uri);
        if (!source) {
            panel.innerHTML = '<div class="placeholder">Loading…</div>';
            api(`/api/source?uri=${encodeURIComponent(node.uri)}`)
                .then(({ content }) => {
                    state.sources.set(node.uri, content);
                    scheduleRender();
                })
                .catch((err) => { panel.innerHTML = `<div class="placeholder">${escapeHtml(err.message)}</div>`; });
            return;
        }
        const test = node.kind === 'test' ? state.tests.get(node.id) : null;
        const stepStatus = new Map((test?.steps ?? []).filter((step) => step.line).map((step) => [step.line, step.status]));
        panel.innerHTML = `<div class="source">${source.split(/\r?\n/).map((line, index) => {
            const number = index + 1;
            const status = stepStatus.get(number);
            return `<div class="line${number === node.line ? ' current' : ''}" data-line="${number}">
                <span class="num">${number}</span>
                <span class="gutter">${status && status !== 'idle' ? statusIcon(status) : ''}</span>
                <span class="code">${highlightGherkin(line)}</span>
            </div>`;
        }).join('')}</div>`;
        const current = panel.querySelector('.line.current');
        if (current && panel.dataset.scrolledTo !== node.id) {
            panel.dataset.scrolledTo = node.id;
            current.scrollIntoView({ block: 'center' });
        }
    }

    // minimal ANSI SGR -> html converter for console output
    function ansiToHtml(text) {
        let open = [];
        let html = '';
        const parts = String(text).split(/\x1b\[([\d;]*)m/);
        for (let i = 0; i < parts.length; i++) {
            if (i % 2 === 0) {
                html += escapeHtml(parts[i]);
                continue;
            }
            const codes = parts[i] === '' ? [0] : parts[i].split(';').map(Number);
            for (const code of codes) {
                if (code === 0 || code === 22 || code === 39 || code === 23 || code === 24) {
                    html += '</span>'.repeat(open.length);
                    open = [];
                    continue;
                }
                const cls = code === 1 ? 'ansi-bold'
                    : code === 2 ? 'ansi-dim'
                        : code === 3 ? 'ansi-italic'
                            : code === 4 ? 'ansi-underline'
                                : (code >= 30 && code <= 37) || (code >= 90 && code <= 97) ? `ansi-${code}` : null;
                if (cls) {
                    html += `<span class="${cls}">`;
                    open.push(cls);
                }
            }
        }
        return html + '</span>'.repeat(open.length);
    }

    function renderOutput(panel) {
        const stickToBottom = panel.scrollHeight - panel.scrollTop - panel.clientHeight < 40;
        const text = state.output.map((chunk) => chunk.stream === 'stderr'
            ? `<span class="stderr">${ansiToHtml(chunk.text)}</span>`
            : ansiToHtml(chunk.text)).join('');
        panel.innerHTML = `
            <div class="output-toolbar"><button class="btn" id="clear-output">Clear</button></div>
            <pre class="output">${text || '<span class="ansi-dim">No output yet</span>'}</pre>`;
        if (stickToBottom) panel.scrollTop = panel.scrollHeight;
    }

    function renderTabs() {
        for (const tab of document.querySelectorAll('.tabs button')) {
            tab.setAttribute('aria-selected', String(tab.dataset.tab === state.tab));
        }
        const badge = $('#output-badge');
        badge.className = 'badge' + (state.output.some((chunk) => chunk.stream === 'stderr') ? ' has-errors' : state.output.length ? ' has-output' : '');
        const panel = $('#panel');
        if (state.tab === 'source') renderSource(panel);
        else if (state.tab === 'output') renderOutput(panel);
        else renderSteps(panel);
    }

    function render() {
        renderToolbar();
        renderTree();
        renderSummary();
        renderBanner();
        renderDetails();
        renderTabs();
    }

    // ---------- events from server ----------
    function applyEvent(event) {
        switch (event.type) {
            case 'snapshot':
                state.tree = event.tree;
                state.tests = new Map(event.tests.map((test) => [test.id, test]));
                state.run = event.run;
                state.output = event.output;
                state.error = event.error;
                state.sources.clear();
                break;
            case 'tree':
                state.tree = event.tree;
                state.tests = new Map(event.tests.map((test) => [test.id, test]));
                state.sources.clear();
                break;
            case 'test':
                state.tests.set(event.test.id, event.test);
                break;
            case 'run':
                state.run = event.run;
                break;
            case 'output':
                state.output.push({ text: event.text, stream: event.stream });
                if (state.output.length > 5000) state.output.splice(0, state.output.length - 5000);
                break;
            case 'error':
                state.error = event.message;
                break;
        }
        scheduleRender();
    }

    function connect() {
        const source = new EventSource('/api/events');
        source.onopen = () => {
            state.connected = true;
            scheduleRender();
        };
        source.onmessage = (message) => applyEvent(JSON.parse(message.data));
        source.onerror = () => {
            state.connected = false;
            scheduleRender();
        };
    }

    // ticking clock for run duration
    setInterval(() => {
        if (state.run.state === 'running') renderSummary();
    }, 1000);

    // ---------- dom listeners ----------
    function bind() {
        $('#btn-run').innerHTML = ICONS.run;
        $('#btn-stop').innerHTML = ICONS.stop;
        $('#btn-reload').innerHTML = ICONS.reload;

        $('#btn-run').addEventListener('click', runAllVisible);
        $('#btn-stop').addEventListener('click', () => api('/api/stop', {}).catch((err) => showToast(err.message)));
        $('#btn-reload').addEventListener('click', () => api('/api/discover', {}).catch((err) => showToast(err.message)));

        const filter = $('#filter');
        filter.value = state.filter;
        filter.addEventListener('input', () => {
            state.filter = filter.value;
            storage.set('filter', state.filter);
            scheduleRender();
        });

        $('#status-filter').addEventListener('click', (event) => {
            const chip = event.target.closest('button[data-status]');
            if (!chip) return;
            state.statusFilter = chip.dataset.status;
            storage.set('statusFilter', state.statusFilter);
            scheduleRender();
        });

        const runFromNode = (id) => {
            const found = findNode(id);
            if (!found) return;
            const ids = visibleTestIds(found.node);
            if (ids.length) runTests(ids);
        };

        $('#tree').addEventListener('click', (event) => {
            const runButton = event.target.closest('[data-run]');
            if (runButton) {
                event.stopPropagation();
                runFromNode(runButton.dataset.run);
                return;
            }
            const row = event.target.closest('.row');
            if (!row) return;
            if (row.dataset.kind !== 'test' && (event.target.closest('.chevron') || state.selected === row.dataset.id)) {
                toggle(row.dataset.id);
            }
            select(row.dataset.id);
        });

        $('#tree').addEventListener('keydown', (event) => {
            const row = event.target.closest('.row');
            if (!row) return;
            const rows = [...document.querySelectorAll('#tree .row')];
            const index = rows.indexOf(row);
            const focus = (target) => {
                if (!target) return;
                target.focus();
                select(target.dataset.id);
            };
            if (event.key === 'ArrowDown') { event.preventDefault(); focus(rows[index + 1]); }
            else if (event.key === 'ArrowUp') { event.preventDefault(); focus(rows[index - 1]); }
            else if (event.key === 'Enter') { event.preventDefault(); runFromNode(row.dataset.id); }
            else if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && row.dataset.kind !== 'test') {
                const collapsed = state.collapsed.has(row.dataset.id);
                if ((event.key === 'ArrowLeft') !== collapsed) toggle(row.dataset.id);
            }
        });

        // keep keyboard focus on the selected row after re-render
        new MutationObserver(() => {
            if (document.activeElement === document.body && state.selected && $('#tree').dataset.keyboard === '1') {
                const selected = document.querySelector('#tree .row.selected');
                selected?.focus({ preventScroll: true });
            }
        }).observe($('#tree'), { childList: true });
        $('#tree').addEventListener('keydown', () => { $('#tree').dataset.keyboard = '1'; }, true);
        $('#tree').addEventListener('mousedown', () => { $('#tree').dataset.keyboard = '0'; }, true);

        $('#details').addEventListener('click', (event) => {
            const runButton = event.target.closest('[data-run]');
            if (runButton) return runFromNode(runButton.dataset.run);
            const tag = event.target.closest('[data-tag]');
            if (tag) {
                state.filter = tag.dataset.tag;
                filter.value = state.filter;
                storage.set('filter', state.filter);
                scheduleRender();
            }
        });

        document.querySelector('.tabs').addEventListener('click', (event) => {
            const tab = event.target.closest('[data-tab]');
            if (!tab) return;
            state.tab = tab.dataset.tab;
            storage.set('tab', state.tab);
            $('#panel').scrollTop = 0;
            delete $('#panel').dataset.scrolledTo;
            scheduleRender();
        });

        $('#panel').addEventListener('click', (event) => {
            if (event.target.closest('#clear-output')) {
                state.output = [];
                scheduleRender();
            }
        });

        // resizable sidebar
        const splitter = $('#splitter');
        const savedWidth = storage.get('sidebarWidth', null);
        if (savedWidth) document.documentElement.style.setProperty('--sidebar-width', `${savedWidth}px`);
        splitter.addEventListener('pointerdown', (event) => {
            splitter.setPointerCapture(event.pointerId);
            splitter.classList.add('dragging');
            const move = (moveEvent) => {
                const width = Math.min(Math.max(220, moveEvent.clientX), window.innerWidth - 320);
                document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
                storage.set('sidebarWidth', width);
            };
            const up = () => {
                splitter.classList.remove('dragging');
                splitter.removeEventListener('pointermove', move);
                splitter.removeEventListener('pointerup', up);
            };
            splitter.addEventListener('pointermove', move);
            splitter.addEventListener('pointerup', up);
        });

        // global shortcuts
        document.addEventListener('keydown', (event) => {
            if (event.key === 'F5' || ((event.metaKey || event.ctrlKey) && event.key === 'Enter')) {
                event.preventDefault();
                runAllVisible();
            } else if (event.key === 'Escape' && state.run.state === 'running') {
                api('/api/stop', {}).catch(() => {});
            } else if (event.key === '/' && document.activeElement !== filter) {
                event.preventDefault();
                filter.focus();
            }
        });
    }

    bind();
    render();
    connect();
})();
