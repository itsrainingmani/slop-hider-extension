// GitHub Bot Comment Collapser
// Collapses TOP-LEVEL comments from accounts tagged as "Bot" on GitHub PRs and issues

(function () {
  'use strict';

  const COLLAPSED_CLASS = 'gbc-collapsed';
  const TOGGLE_BTN_CLASS = 'gbc-toggle-btn';
  const PROCESSED_ATTR = 'data-gbc-processed';

  // Track global state: 'collapsed' | 'expanded' | 'mixed'
  let globalState = 'collapsed';

  // SVG icons - open eye = content hidden (click to show), closed eye = content shown (click to hide)
  const ICONS = {
    // Eye open - content is hidden, click to show
    collapsed: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 2c-3.636 0-6.034 2.727-7.148 4.308a4.22 4.22 0 0 0 0 3.384C1.966 11.273 4.364 14 8 14s6.034-2.727 7.148-4.308a4.22 4.22 0 0 0 0-3.384C14.034 4.727 11.636 2 8 2ZM8 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm0 1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/>
    </svg>`,
    // Eye closed - content is shown, click to hide
    expanded: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M.143 2.31a.75.75 0 0 1 1.047-.167l14.5 10.5a.75.75 0 1 1-.88 1.214l-2.248-1.628C11.346 13.19 9.792 14 8 14c-3.636 0-6.034-2.727-7.148-4.308a4.22 4.22 0 0 1 0-3.384c.39-.553.848-1.095 1.36-1.594L.31 3.357a.75.75 0 0 1-.167-1.047ZM5.09 7.25A3 3 0 0 0 8 11a2.99 2.99 0 0 0 1.66-.5l-.973-.704A1.5 1.5 0 0 1 6.5 8c0-.065.004-.129.012-.192L5.09 7.25Zm6.148 2.664 1.667 1.208c.388-.363.73-.752 1.022-1.138a2.72 2.72 0 0 0 0-1.968C13.056 6.727 10.636 4 8 4a5.6 5.6 0 0 0-1.876.324l1.348.976A3 3 0 0 1 11 8c0 .716-.252 1.373-.672 1.888l.91.026Z"/>
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

  // Check if the timeline item has substantial content worth collapsing
  // (comments, reviews, etc. - NOT simple actions like "added a label")
  function hasCollapsibleContent(container) {
    // Must have a comment body, review body, or similar content
    const hasBody = container.querySelector(
      '.comment-body, ' +
      '.js-comment-body, ' +
      '.markdown-body, ' +
      '.review-comment-body, ' +
      '.js-review-body, ' +
      '.review-summary-body, ' +
      '.js-pull-request-review-body, ' +
      '[data-testid="markdown-body"]'
    );

    // Or it's a review with file changes
    const hasReviewContent = container.querySelector(
      '.js-reviewed-files-container, ' +
      '[id^="pullrequestreview"], ' +
      '.js-pull-request-review'
    );

    return !!(hasBody || hasReviewContent);
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
    btn.setAttribute('aria-label', isCollapsed ? 'Show bot comment' : 'Hide bot comment');
    
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
    btn.setAttribute('aria-label', isCollapsed ? 'Show bot comment' : 'Hide bot comment');
    btn.title = isCollapsed ? 'Show' : 'Hide';
  }

  function toggleComment(container, btn) {
    const isCollapsed = container.classList.toggle(COLLAPSED_CLASS);
    updateToggleButton(btn, isCollapsed);
    globalState = 'mixed';
    updateSidebarWidget();
  }

  // Find the header element to attach the toggle button to
  // The button should always appear to the right of the header that contains collapsible content
  function findHeaderAnchor(container) {
    // Look for the most specific header that precedes actual content
    // Priority: innermost comment header > review header > fallback
    
    // For standard comments with a header bar
    const timelineCommentHeader = container.querySelector('.timeline-comment-header');
    if (timelineCommentHeader) {
      return timelineCommentHeader;
    }
    
    // For TimelineItem style (newer GitHub UI)
    const timelineItemHeader = container.querySelector('.TimelineItem-header');
    if (timelineItemHeader) {
      return timelineItemHeader;
    }
    
    // For review comments - find the header within the comment box
    const reviewHeader = container.querySelector('.review-comment-header, .review-summary-header');
    if (reviewHeader) {
      return reviewHeader;
    }
    
    // Fallback: look for any header-like element with author info
    const authorHeader = container.querySelector('[class*="comment-header"], [class*="Header"]');
    if (authorHeader) {
      return authorHeader;
    }
    
    // Last resort: the container's first child that looks like a header
    // (usually contains avatar + author name + timestamp)
    const firstChild = container.querySelector('.timeline-comment, .TimelineItem-body');
    if (firstChild) {
      return firstChild;
    }
    
    return container;
  }

  function processComment(container) {
    if (container.hasAttribute(PROCESSED_ATTR)) return;
    container.setAttribute(PROCESSED_ATTR, 'true');

    if (!isTopLevelComment(container)) return;
    if (!isBotComment(container)) return;
    if (!hasCollapsibleContent(container)) return; // Skip simple actions like "added a label"

    // Determine initial state based on global preference
    const shouldCollapse = globalState !== 'expanded';

    // Create toggle button
    const btn = createToggleButton(container, shouldCollapse);
    
    // Attach button to the header element so it appears to the right of the header
    const headerAnchor = findHeaderAnchor(container);
    headerAnchor.style.position = 'relative';
    headerAnchor.appendChild(btn);

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
    const hidden = getCollapsedCount();
    const shown = total - hidden;

    const countEl = widget.querySelector('.gbc-sidebar-count');
    if (countEl) countEl.textContent = total;

    const statusEl = widget.querySelector('.gbc-sidebar-status');
    if (statusEl) statusEl.textContent = `${hidden} hidden, ${shown} shown`;

    const hideBtn = widget.querySelector('.gbc-btn-collapse');
    const showBtn = widget.querySelector('.gbc-btn-expand');
    if (hideBtn) hideBtn.disabled = hidden === total;
    if (showBtn) showBtn.disabled = shown === total;
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
    const hidden = getCollapsedCount();
    const shown = total - hidden;

    const widget = document.createElement('div');
    widget.id = 'gbc-sidebar-widget';
    widget.className = 'gbc-sidebar-widget';

    widget.innerHTML = `
      <div class="gbc-sidebar-header">
        <span class="gbc-sidebar-icon">🤖</span>
        <span class="gbc-sidebar-title">Slop Hider</span>
        <span class="gbc-sidebar-count">${total}</span>
      </div>
      <div class="gbc-sidebar-status">
        ${hidden} hidden, ${shown} shown
      </div>
      <div class="gbc-sidebar-buttons">
        <button class="gbc-btn gbc-btn-collapse" ${hidden === total ? 'disabled' : ''}>
          Hide All
        </button>
        <button class="gbc-btn gbc-btn-expand" ${shown === total ? 'disabled' : ''}>
          Show All
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
