// GitHub Bot Comment Collapser
// Collapses TOP-LEVEL comments from accounts tagged as "Bot" on GitHub PRs and issues

(function () {
  'use strict';

  const COLLAPSED_CLASS = 'gbc-collapsed';
  const TOGGLE_CLASS = 'gbc-toggle';
  const PROCESSED_ATTR = 'data-gbc-processed';

  // Track global state: 'collapsed' | 'expanded' | 'mixed'
  // New items will inherit this state
  let globalState = 'collapsed';

  // Check if this is a top-level timeline comment (not nested in other comments)
  function isTopLevelComment(container) {
    const parent = container.parentElement;
    if (!parent) return false;

    const nestedSelectors = [
      '.js-timeline-item',
      '.TimelineItem',
      '.timeline-comment-group',
      '.comment-body',
      '.js-comment-body',
      '.markdown-body',
      '.edit-comment-hide',
      '.js-diff-progressive-container',
      '.review-thread',
      '.inline-comments',
      '.comment-holder',
      '.js-resolvable-thread-contents',
      '.js-line-comments',
      '.blob-wrapper',
      '.file-diff-split',
      '.diff-table',
      '.review-comment',
    ];

    for (const selector of nestedSelectors) {
      if (parent.closest(selector)) {
        return false;
      }
    }

    return true;
  }

  // Check if an element contains a bot badge
  function isBotComment(container) {
    const labels = container.querySelectorAll(
      '.Label, .AppBadge, [class*="Label"], span[class*="badge"], .author-badge'
    );

    for (const label of labels) {
      const text = label.textContent?.trim().toLowerCase();
      if (text === 'bot' || text === 'app') {
        return true;
      }
    }

    const authorLink = container.querySelector(
      '.author, [data-hovercard-type="user"], a[data-testid="author-link"]'
    );
    if (authorLink) {
      const hovercardUrl = authorLink.getAttribute('data-hovercard-url') || '';
      if (hovercardUrl.includes('/apps/') || hovercardUrl.includes('/bots/')) {
        return true;
      }
    }

    const authorText = container.querySelector('.author, .js-issue-comment-username');
    if (authorText && authorText.textContent?.toLowerCase().includes('[bot]')) {
      return true;
    }

    return false;
  }

  // Detect if the comment is a review or a regular comment
  function getCommentType(container) {
    const isReview =
      container.classList.contains('js-pull-request-review') ||
      container.querySelector('.review-summary, .js-review, [data-testid="review-summary"]') ||
      container.querySelector('.pull-request-review-menu') ||
      container.querySelector('h3.review-title, h4.review-status-heading') ||
      container.querySelector('[id^="pullrequestreview"]') ||
      container.querySelector('.State--approved, .State--changes-requested, .State--commented');

    return isReview ? 'review' : 'comment';
  }

  // SVG icons for different comment types
  const ICONS = {
    comment: `<svg class="gbc-type-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M1 2.75C1 1.784 1.784 1 2.75 1h10.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0 1 13.25 12H9.06l-2.573 2.573A1.458 1.458 0 0 1 4 13.543V12H2.75A1.75 1.75 0 0 1 1 10.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h2a.75.75 0 0 1 .75.75v2.19l2.72-2.72a.749.749 0 0 1 .53-.22h4.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
    </svg>`,
    review: `<svg class="gbc-type-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 2c1.981 0 3.671.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.45.678-1.367 1.932-2.637 3.023C11.67 13.008 9.981 14 8 14c-1.981 0-3.671-.992-4.933-2.078C1.797 10.83.88 9.576.43 8.898a1.62 1.62 0 0 1 0-1.798c.45-.677 1.367-1.931 2.637-3.022C4.33 2.992 6.019 2 8 2ZM1.679 7.932a.12.12 0 0 0 0 .136c.411.622 1.241 1.75 2.366 2.717C5.176 11.758 6.527 12.5 8 12.5c1.473 0 2.825-.742 3.955-1.715 1.124-.967 1.954-2.096 2.366-2.717a.12.12 0 0 0 0-.136c-.412-.621-1.242-1.75-2.366-2.717C10.824 4.242 9.473 3.5 8 3.5c-1.473 0-2.824.742-3.955 1.715-1.124.967-1.954 2.096-2.366 2.717ZM8 10a2 2 0 1 1-.001-3.999A2 2 0 0 1 8 10Z"/>
    </svg>`,
  };

  // Create the collapsed header showing bot info
  function createCollapsedHeader(container) {
    const header = document.createElement('div');
    header.className = `${TOGGLE_CLASS}`;

    const authorEl = container.querySelector(
      '.author, .js-issue-comment-username, [data-testid="author-link"]'
    );
    const author = authorEl?.textContent?.trim() || 'Bot';

    const timeEl = container.querySelector('relative-time, time');
    const time = timeEl?.getAttribute('title') || timeEl?.textContent || '';

    const bodyEl = container.querySelector(
      '.comment-body, .js-comment-body, [data-testid="markdown-body"], .markdown-body'
    );
    const lineCount = bodyEl ? bodyEl.innerText.split('\n').filter((l) => l.trim()).length : 0;

    const commentType = getCommentType(container);
    const typeIcon = ICONS[commentType];
    const typeLabel = commentType === 'review' ? 'Review' : 'Comment';
    const labelClass = commentType === 'review' ? 'gbc-label-review' : 'gbc-label-comment';

    header.innerHTML = `
      <span class="gbc-icon">&#9654;</span>
      ${typeIcon}
      <span class="gbc-label ${labelClass}">Bot ${typeLabel}</span>
      <span class="gbc-author">${escapeHtml(author)}</span>
      <span class="gbc-meta">${lineCount} lines</span>
      ${time ? `<span class="gbc-time">${escapeHtml(time)}</span>` : ''}
      <span class="gbc-hint">Click to expand</span>
    `;

    header.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleComment(container, header);
    });

    return header;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function toggleComment(container, header) {
    const isCollapsed = container.classList.toggle(COLLAPSED_CLASS);
    const icon = header.querySelector('.gbc-icon');
    const hint = header.querySelector('.gbc-hint');

    if (isCollapsed) {
      icon.innerHTML = '&#9654;';
      hint.textContent = 'Click to expand';
    } else {
      icon.innerHTML = '&#9660;';
      hint.textContent = 'Click to collapse';
    }

    // Individual toggle sets state to mixed
    globalState = 'mixed';
    updateSidebarWidget();
  }

  function processComment(container) {
    if (container.hasAttribute(PROCESSED_ATTR)) return;
    container.setAttribute(PROCESSED_ATTR, 'true');

    if (!isTopLevelComment(container)) return;
    if (!isBotComment(container)) return;

    const header = createCollapsedHeader(container);
    container.insertBefore(header, container.firstChild);

    // Apply current global state to new comments
    const shouldCollapse = globalState !== 'expanded';
    
    if (shouldCollapse) {
      container.classList.add(COLLAPSED_CLASS);
    } else {
      // Set expanded state on the header
      const icon = header.querySelector('.gbc-icon');
      const hint = header.querySelector('.gbc-hint');
      if (icon) icon.innerHTML = '&#9660;';
      if (hint) hint.textContent = 'Click to collapse';
    }
  }

  function processAllComments() {
    const containers = document.querySelectorAll(`
      .js-timeline-item,
      .TimelineItem,
      .timeline-comment-group
    `);

    containers.forEach(processComment);
  }

  function setupObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldProcess = false;

      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldProcess = true;
          break;
        }
      }

      if (shouldProcess) {
        clearTimeout(setupObserver.timeout);
        setupObserver.timeout = setTimeout(() => {
          processAllComments();
          updateSidebarWidget();
        }, 100);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function collapseAll() {
    globalState = 'collapsed';
    document.querySelectorAll(`.${TOGGLE_CLASS}`).forEach((header) => {
      const container = header.parentElement;
      if (container && !container.classList.contains(COLLAPSED_CLASS)) {
        // Directly manipulate without calling toggleComment to avoid setting 'mixed'
        container.classList.add(COLLAPSED_CLASS);
        const icon = header.querySelector('.gbc-icon');
        const hint = header.querySelector('.gbc-hint');
        if (icon) icon.innerHTML = '&#9654;';
        if (hint) hint.textContent = 'Click to expand';
      }
    });
    updateSidebarWidget();
  }

  function expandAll() {
    globalState = 'expanded';
    document.querySelectorAll(`[${PROCESSED_ATTR}="true"].${COLLAPSED_CLASS}`).forEach((container) => {
      const header = container.querySelector(`.${TOGGLE_CLASS}`);
      if (header) {
        // Directly manipulate without calling toggleComment to avoid setting 'mixed'
        container.classList.remove(COLLAPSED_CLASS);
        const icon = header.querySelector('.gbc-icon');
        const hint = header.querySelector('.gbc-hint');
        if (icon) icon.innerHTML = '&#9660;';
        if (hint) hint.textContent = 'Click to collapse';
      }
    });
    updateSidebarWidget();
  }

  function getBotCommentCount() {
    return document.querySelectorAll(`.${TOGGLE_CLASS}`).length;
  }

  function getCollapsedCount() {
    return document.querySelectorAll(`.${COLLAPSED_CLASS} .${TOGGLE_CLASS}`).length;
  }

  function updateSidebarWidget() {
    const widget = document.getElementById('gbc-sidebar-widget');
    if (!widget) return;

    const total = getBotCommentCount();
    const collapsed = getCollapsedCount();
    const expanded = total - collapsed;

    const countEl = widget.querySelector('.gbc-sidebar-count');
    if (countEl) countEl.textContent = total;

    const statusEl = widget.querySelector('.gbc-sidebar-status');
    if (statusEl) statusEl.textContent = `${collapsed} collapsed, ${expanded} expanded`;

    const collapseBtn = widget.querySelector('.gbc-btn-collapse');
    const expandBtn = widget.querySelector('.gbc-btn-expand');
    if (collapseBtn) collapseBtn.disabled = collapsed === total;
    if (expandBtn) expandBtn.disabled = expanded === total;
  }

  function createSidebarWidget() {
    if (document.getElementById('gbc-sidebar-widget')) return;

    const sidebar = document.querySelector(
      '.Layout-sidebar, .discussion-sidebar, #partial-discussion-sidebar, [data-testid="sidebar"]'
    );
    if (!sidebar) return;

    const botCount = getBotCommentCount();
    if (botCount === 0) return;

    const total = botCount;
    const collapsed = getCollapsedCount();
    const expanded = total - collapsed;

    const widget = document.createElement('div');
    widget.id = 'gbc-sidebar-widget';
    widget.className = 'gbc-sidebar-widget';

    widget.innerHTML = `
      <div class="gbc-sidebar-header">
        <span class="gbc-sidebar-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0a8 8 0 110 16A8 8 0 018 0zM5.78 8.75a9.64 9.64 0 001.363 4.177c.255.426.542.832.857 1.215.245-.296.551-.705.857-1.215A9.64 9.64 0 0010.22 8.75H5.78zm4.44-1.5a9.64 9.64 0 00-1.363-4.177c-.307-.51-.612-.919-.857-1.215a9.927 9.927 0 00-.857 1.215A9.64 9.64 0 005.78 7.25h4.44zm-5.944 1.5H1.543a6.507 6.507 0 004.666 5.5c-.123-.181-.24-.365-.352-.552-.715-1.192-1.437-2.874-1.581-4.948zm-2.733-1.5h2.733c.144-2.074.866-3.756 1.58-4.948.12-.197.237-.381.353-.552a6.507 6.507 0 00-4.666 5.5zm10.181 1.5c-.144 2.074-.866 3.756-1.581 4.948-.111.187-.229.371-.352.552a6.507 6.507 0 004.666-5.5h-2.733zm2.733-1.5a6.507 6.507 0 00-4.666-5.5c.123.181.24.365.352.552.715 1.192 1.437 2.874 1.581 4.948h2.733z"/>
          </svg>
        </span>
        <span class="gbc-sidebar-title">Bot Comments</span>
        <span class="gbc-sidebar-count">${total}</span>
      </div>
      <div class="gbc-sidebar-status">
        ${collapsed} collapsed, ${expanded} expanded
      </div>
      <div class="gbc-sidebar-buttons">
        <button class="gbc-btn gbc-btn-collapse" ${collapsed === total ? 'disabled' : ''}>
          Collapse All
        </button>
        <button class="gbc-btn gbc-btn-expand" ${expanded === total ? 'disabled' : ''}>
          Expand All
        </button>
      </div>
    `;

    widget.querySelector('.gbc-btn-collapse')?.addEventListener('click', () => {
      collapseAll();
    });
    widget.querySelector('.gbc-btn-expand')?.addEventListener('click', () => {
      expandAll();
    });

    const firstChild = sidebar.firstElementChild;
    if (firstChild) {
      sidebar.insertBefore(widget, firstChild);
    } else {
      sidebar.appendChild(widget);
    }

    return widget;
  }

  function refreshSidebarWidget() {
    const existing = document.getElementById('gbc-sidebar-widget');
    if (existing) existing.remove();
    setTimeout(createSidebarWidget, 200);
  }

  window.githubBotCollapser = {
    collapseAll,
    expandAll,
    processAllComments,
    refreshSidebarWidget,
    updateSidebarWidget,
    getState: () => globalState,
  };

  function init() {
    processAllComments();
    setupObserver();
    setTimeout(createSidebarWidget, 500);

    document.addEventListener('turbo:load', () => {
      processAllComments();
      refreshSidebarWidget();
    });
    document.addEventListener('turbo:render', () => {
      processAllComments();
      refreshSidebarWidget();
    });
    document.addEventListener('pjax:end', () => {
      processAllComments();
      refreshSidebarWidget();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
