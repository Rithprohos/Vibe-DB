import { getFontEmbedCSS, toCanvas } from 'html-to-image';

const SCREENSHOT_MIN_PIXEL_RATIO = 2;
const SCREENSHOT_TARGET_PIXEL_RATIO = 3;
const SCREENSHOT_MAX_PIXEL_COUNT = 24_000_000;
const SCREENSHOT_HEADER_HEIGHT = 52;
const SCREENSHOT_HEADER_LABEL = 'SCHEMA SCREENSHOT';
const SCREENSHOT_HEADER_REPOSITORY = 'Rithprohos/Vibe-DB';

const SCREENSHOT_STYLE_RULES: ReadonlyArray<{
  properties: readonly string[];
  selector: string;
}> = [
  {
    selector: '[data-screenshot-role="dot-grid"]',
    properties: ['background-color', 'background-image', 'background-size'],
  },
  {
    selector: '[data-screenshot-role="glow-layer"]',
    properties: ['background', 'background-image', 'opacity'],
  },
  {
    selector: '.schema-table-card',
    properties: ['background-color', 'border-color', 'box-shadow'],
  },
  {
    selector: '.schema-helper-chip',
    properties: ['background-color', 'border-color', 'box-shadow', 'color'],
  },
  {
    selector: '.schema-relationship-path-glow',
    properties: ['stroke', 'stroke-width', 'opacity'],
  },
  {
    selector: '.schema-relationship-path',
    properties: ['stroke', 'stroke-width', 'stroke-dasharray', 'opacity'],
  },
  {
    selector: '[data-screenshot-role="relationship-source"]',
    properties: ['fill', 'stroke', 'stroke-width', 'opacity'],
  },
  {
    selector: '[data-screenshot-role="relationship-target"]',
    properties: ['fill', 'stroke', 'stroke-width', 'opacity'],
  },
];

function isScreenshotExcludedNode(node: Node | null | undefined): boolean {
  return node instanceof Element && node.getAttribute('data-screenshot-exclude') === 'true';
}

function getScreenshotPixelRatio(width: number, height: number): number {
  const totalHeight = height + SCREENSHOT_HEADER_HEIGHT;
  const deviceRatio = window.devicePixelRatio || 1;
  const preferredRatio = Math.min(
    SCREENSHOT_TARGET_PIXEL_RATIO,
    Math.max(SCREENSHOT_MIN_PIXEL_RATIO, deviceRatio),
  );
  const maxRatioByPixelCount = Math.sqrt(
    SCREENSHOT_MAX_PIXEL_COUNT / Math.max(1, width * totalHeight),
  );

  return Math.max(1, Number(Math.min(preferredRatio, maxRatioByPixelCount).toFixed(2)));
}

function applyInlineStyles(
  element: HTMLElement | SVGElement,
  styles: Partial<CSSStyleDeclaration>,
): void {
  Object.assign(element.style, styles);
}

function createGithubMark(foregroundColor: string): SVGSVGElement {
  const githubIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  githubIcon.setAttribute('viewBox', '0 0 16 16');
  githubIcon.setAttribute('width', '14');
  githubIcon.setAttribute('height', '14');
  githubIcon.setAttribute('aria-hidden', 'true');
  applyInlineStyles(githubIcon, {
    display: 'block',
    fill: foregroundColor,
  });

  const githubPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  githubPath.setAttribute(
    'd',
    'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49C4 14.09 3.48 13.23 3.32 12.78c-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.51 7.51 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z',
  );
  githubIcon.appendChild(githubPath);

  return githubIcon;
}

function createExportHeader(
  borderColor: string,
  foregroundColor: string,
  secondaryColor: string,
): HTMLDivElement {
  const header = document.createElement('div');
  applyInlineStyles(header, {
    height: `${SCREENSHOT_HEADER_HEIGHT}px`,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '0 18px',
    borderBottom: `1px solid ${borderColor}`,
    backgroundColor: secondaryColor,
    color: foregroundColor,
    fontSize: '12px',
    fontWeight: '600',
    fontFamily:
      'ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  });

  const titleLabel = document.createElement('span');
  titleLabel.textContent = SCREENSHOT_HEADER_LABEL;
  applyInlineStyles(titleLabel, {
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace',
    fontSize: '11px',
    fontWeight: '700',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
  });

  const separator = document.createElement('span');
  separator.textContent = '•';
  separator.style.opacity = '0.45';

  const githubWrap = document.createElement('span');
  applyInlineStyles(githubWrap, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    fontWeight: '600',
  });

  const repositoryLabel = document.createElement('span');
  repositoryLabel.textContent = SCREENSHOT_HEADER_REPOSITORY;

  githubWrap.append(createGithubMark(foregroundColor), repositoryLabel);
  header.append(titleLabel, separator, githubWrap);

  return header;
}

function inlineResolvedStyles(sourceRoot: Element, cloneRoot: Element): void {
  const stack: Array<{ source: Element; target: Element }> = [{ source: sourceRoot, target: cloneRoot }];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    const computedStyle = window.getComputedStyle(current.source);
    if (current.target instanceof HTMLElement || current.target instanceof SVGElement) {
      for (let index = 0; index < computedStyle.length; index += 1) {
        const property = computedStyle[index];
        current.target.style.setProperty(
          property,
          computedStyle.getPropertyValue(property),
          computedStyle.getPropertyPriority(property),
        );
      }
    }

    const sourceChildren = Array.from(current.source.children);
    const targetChildren = Array.from(current.target.children);
    for (let index = Math.min(sourceChildren.length, targetChildren.length) - 1; index >= 0; index -= 1) {
      stack.push({
        source: sourceChildren[index],
        target: targetChildren[index],
      });
    }
  }
}

function syncComputedStyles(viewport: HTMLDivElement, clone: HTMLDivElement): void {
  for (const { selector, properties } of SCREENSHOT_STYLE_RULES) {
    const sourceNodes = Array.from(viewport.querySelectorAll(selector));
    const cloneNodes = Array.from(clone.querySelectorAll(selector));
    const pairCount = Math.min(sourceNodes.length, cloneNodes.length);

    for (let index = 0; index < pairCount; index += 1) {
      const computedStyle = window.getComputedStyle(sourceNodes[index]);
      const cloneNode = cloneNodes[index];
      for (const property of properties) {
        const value = computedStyle.getPropertyValue(property);
        if (value && (cloneNode instanceof HTMLElement || cloneNode instanceof SVGElement)) {
          cloneNode.style.setProperty(property, value);
        }
      }
    }
  }
}

function waitForNextPaint(): Promise<void> {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

export async function captureViewportCanvas(
  viewport: HTMLDivElement,
): Promise<HTMLCanvasElement> {
  const rect = viewport.getBoundingClientRect();
  const roundedWidth = Math.max(1, Math.ceil(rect.width));
  const roundedHeight = Math.max(1, Math.ceil(rect.height));
  const pixelRatio = getScreenshotPixelRatio(roundedWidth, roundedHeight);
  const viewportStyle = window.getComputedStyle(viewport);
  const borderColor =
    viewportStyle.getPropertyValue('--border').trim() || 'rgba(148, 163, 184, 0.2)';
  const secondaryColor =
    viewportStyle.getPropertyValue('--secondary').trim() || viewportStyle.backgroundColor;
  const foregroundColor = viewportStyle.getPropertyValue('--foreground').trim() || '#111827';
  const wrapper = document.createElement('div');
  const exportStage = document.createElement('div');
  const clone = viewport.cloneNode(true) as HTMLDivElement;

  applyInlineStyles(wrapper, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    pointerEvents: 'none',
    opacity: '0',
    zIndex: '-1',
  });

  wrapper.appendChild(exportStage);
  document.body.appendChild(wrapper);

  applyInlineStyles(exportStage, {
    width: `${roundedWidth}px`,
    height: `${roundedHeight + SCREENSHOT_HEADER_HEIGHT}px`,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: viewportStyle.backgroundColor,
  });

  applyInlineStyles(clone, {
    width: `${roundedWidth}px`,
    height: `${roundedHeight}px`,
    maxWidth: 'none',
    flex: '1',
  });
  clone.classList.add('schema-export-frame');

  inlineResolvedStyles(viewport, clone);
  syncComputedStyles(viewport, clone);
  exportStage.append(createExportHeader(borderColor, foregroundColor, secondaryColor), clone);

  let fontEmbedCSS: string | undefined;
  let skipFontEmbedding = false;

  try {
    await waitForNextPaint();

    try {
      fontEmbedCSS = await getFontEmbedCSS(viewport, {
        preferredFontFormat: 'woff2',
      });
    } catch (fontError) {
      skipFontEmbedding = true;
      console.warn('Failed to preload schema screenshot fonts:', fontError);
    }

    return await toCanvas(exportStage, {
      backgroundColor: viewportStyle.backgroundColor,
      cacheBust: true,
      filter: (node) => !isScreenshotExcludedNode(node),
      fontEmbedCSS,
      height: roundedHeight + SCREENSHOT_HEADER_HEIGHT,
      pixelRatio,
      preferredFontFormat: 'woff2',
      skipFonts: skipFontEmbedding,
      width: roundedWidth,
    });
  } finally {
    wrapper.remove();
  }
}
