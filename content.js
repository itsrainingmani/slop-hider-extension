// GitHub Bot Comment Collapser
// Collapses TOP-LEVEL comments from accounts tagged as "Bot" on GitHub PRs and issues

(function () {
  'use strict';

  const COLLAPSED_CLASS = 'gbc-collapsed';
  const TOGGLE_BTN_CLASS = 'gbc-toggle-btn';
  const PROCESSED_ATTR = 'data-gbc-processed';

  // Track global state: 'collapsed' | 'expanded' | 'mixed'
  let globalState = 'collapsed';

  // SVG icons for collapse/expand states
  const ICONS = {
    collapsed: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z"/>
    </svg>`,
    expanded: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.94l3.72-3.72a.749.749 0 0 1 1.06 0Z"/>
    </svg>`,
  };

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

  // Create the small toggle button positioned outside the container
  function createToggleButton(container, isCollapsed) {
    const btn = document.createElement('button');
    btn.className = TOGGLE_BTN_CLASS;
    btn.type = 'button';
    btn.setAttribute('aria-label', isCollapsed ? 'Expand bot comment' : 'Collapse bot comment');
    
    const commentType = getCommentType(container);
    btn.dataset.type = commentType;
    
    updateToggleButton(btn, isCollapsed);

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleComment(container, btn);
    });

    return btn;
  }

  function updateToggleButton(btn, isCollapsed) {
    btn.innerHTML = isCollapsed ? ICONS.collapsed : ICONS.expanded;
    btn.setAttribute('aria-label', isCollapsed ? 'Expand bot comment' : 'Collapse bot comment');
    btn.title = isCollapsed ? 'Expand' : 'Collapse';
  }

  function toggleComment(container, btn) {
    const isCollapsed = container.classList.toggle(COLLAPSED_CLASS);
    updateToggleButton(btn, isCollapsed);
    globalState = 'mixed';
    updateSidebarWidget();
  }

  // Find the best element to attach the toggle button to
  // This should be the element that contains the header, so positioning is consistent
  function findButtonAnchor(container) {
    // Prefer the comment box or timeline body - these have consistent structure
    return container.querySelector(
      '.timeline-comment, ' +
      '.TimelineItem-body'
    ) || container;
  }

  function processComment(container) {
    if (container.hasAttribute(PROCESSED_ATTR)) return;
    container.setAttribute(PROCESSED_ATTR, 'true');

    if (!isTopLevelComment(container)) return;
    if (!isBotComment(container)) return;

    // Determine initial state based on global preference
    const shouldCollapse = globalState !== 'expanded';

    // Create toggle button
    const btn = createToggleButton(container, shouldCollapse);
    
    // Find the best anchor element and attach button there
    const anchor = findButtonAnchor(container);
    anchor.style.position = 'relative';
    anchor.appendChild(btn);

    // Apply initial state
    if (shouldCollapse) {
      container.classList.add(COLLAPSED_CLASS);
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
    document.querySelectorAll(`[${PROCESSED_ATTR}="true"]`).forEach((container) => {
      const btn = container.querySelector(`.${TOGGLE_BTN_CLASS}`);
      if (btn && !container.classList.contains(COLLAPSED_CLASS)) {
        container.classList.add(COLLAPSED_CLASS);
        updateToggleButton(btn, true);
      }
    });
    updateSidebarWidget();
  }

  function expandAll() {
    globalState = 'expanded';
    document.querySelectorAll(`[${PROCESSED_ATTR}="true"].${COLLAPSED_CLASS}`).forEach((container) => {
      const btn = container.querySelector(`.${TOGGLE_BTN_CLASS}`);
      if (btn) {
        container.classList.remove(COLLAPSED_CLASS);
        updateToggleButton(btn, false);
      }
    });
    updateSidebarWidget();
  }

  function getBotCommentCount() {
    return document.querySelectorAll(`.${TOGGLE_BTN_CLASS}`).length;
  }

  function getCollapsedCount() {
    return document.querySelectorAll(`.${COLLAPSED_CLASS} .${TOGGLE_BTN_CLASS}`).length;
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
