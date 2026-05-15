/**
 * TOC (Table of Contents) Manager
 * Migrated from Firefly — shared logic for SidebarTOC.
 */

export interface TOCConfig {
	contentId: string;
	indicatorId: string;
	maxLevel?: number;
	scrollOffset?: number;
	emptyText?: string;
}

export class TOCManager {
	private tocItems: HTMLElement[] = [];
	private observer: IntersectionObserver | null = null;
	private minDepth = 10;
	private maxLevel: number;
	private scrollTimeout: number | null = null;
	private contentId: string;
	private indicatorId: string;
	private scrollOffset: number;
	private emptyText: string;

	constructor(config: TOCConfig) {
		this.contentId = config.contentId;
		this.indicatorId = config.indicatorId;
		this.maxLevel = config.maxLevel || 3;
		this.scrollOffset = config.scrollOffset || 80;
		this.emptyText = config.emptyText || "No table of contents on this page";
	}

	private getContentContainer(): Element | null {
		return (
			document.querySelector(".custom-md") ||
			document.querySelector(".prose") ||
			document.querySelector(".markdown-content")
		);
	}

	private getAllHeadings(): HTMLElement[] {
		const contentContainer = this.getContentContainer();
		if (!contentContainer) return [];
		return Array.from(
			contentContainer.querySelectorAll("h1, h2, h3, h4, h5, h6"),
		);
	}

	private calculateMinDepth(headings: HTMLElement[]): number {
		let minDepth = 10;
		headings.forEach((heading) => {
			const depth = Number.parseInt(heading.tagName.charAt(1), 10);
			minDepth = Math.min(minDepth, depth);
		});
		return minDepth;
	}

	private filterHeadings(headings: HTMLElement[]): HTMLElement[] {
		return Array.from(headings).filter((heading) => {
			const depth = Number.parseInt(heading.tagName.charAt(1), 10);
			return depth < this.minDepth + this.maxLevel;
		});
	}

	private escapeHtmlAttr(value: string): string {
		return value
			.replace(/&/g, "&amp;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
	}

	private getCleanTextContent(element: HTMLElement): string {
		const clone = element.cloneNode(true) as HTMLElement;
		for (const el of clone.querySelectorAll("script, style")) {
			el.remove();
		}
		const text = clone.textContent || "";
		// Remove trailing hash marks
		return text.replace(/#+\s*$/, "").trim();
	}

	private generateBadgeContent(depth: number, heading1Count: number): string {
		if (depth === this.minDepth) {
			return heading1Count.toString();
		}
		if (depth === this.minDepth + 1) {
			return '<span class="toc-badge-dot"></span>';
		}
		return '<span class="toc-badge-dot toc-badge-dot-sm"></span>';
	}

	public generateTOCHTML(): string {
		const headings = this.getAllHeadings();

		if (headings.length === 0) {
			return `<div class="text-center py-8 text-black/40 dark:text-white/30"><p>${this.emptyText}</p></div>`;
		}

		this.minDepth = this.calculateMinDepth(headings);
		const filteredHeadings = this.filterHeadings(headings);

		if (filteredHeadings.length === 0) {
			return `<div class="text-center py-8 text-black/40 dark:text-white/30"><p>${this.emptyText}</p></div>`;
		}

		let tocHTML = "";
		let heading1Count = 1;

		filteredHeadings.forEach((heading) => {
			const depth = Number.parseInt(heading.tagName.charAt(1), 10);
			const depthLevel =
				depth === this.minDepth ? 0 : depth === this.minDepth + 1 ? 1 : 2;

			if (!heading.id) return;

			const badgeContent = this.generateBadgeContent(depth, heading1Count);
			if (depth === this.minDepth) heading1Count++;

			let headingText = this.getCleanTextContent(heading);

			if (!headingText) {
				headingText = heading.id || "Heading";
			}

			const escapedHeadingText = this.escapeHtmlAttr(headingText);

			tocHTML += `
        <a
          href="#${heading.id}"
          class="toc-item toc-level-${depthLevel}"
          data-heading-id="${heading.id}"
          aria-label="${escapedHeadingText}"
          title="${escapedHeadingText}"
        >
          <div class="toc-badge ${depth === this.minDepth ? "toc-badge-index" : ""}">
            ${badgeContent}
          </div>
          <div class="toc-label ${depth <= this.minDepth + 1 ? "toc-label-primary" : "toc-label-secondary"}">${headingText}</div>
        </a>
      `;
		});

		tocHTML += `<div id="${this.indicatorId}" style="opacity: 0;" class="toc-active-indicator"></div>`;

		return tocHTML;
	}

	public updateTOCContent(): void {
		const tocContent = document.getElementById(this.contentId);
		if (!tocContent) return;

		tocContent.innerHTML = this.generateTOCHTML();
		this.tocItems = Array.from(
			document.querySelectorAll(`#${this.contentId} a`),
		);
	}

	private getVisibleHeadingIds(): string[] {
		const headings = this.getAllHeadings();
		const visibleHeadingIds: string[] = [];

		headings.forEach((heading) => {
			if (heading.id) {
				const rect = heading.getBoundingClientRect();
				if (rect.top < window.innerHeight && rect.bottom > 0) {
					visibleHeadingIds.push(heading.id);
				}
			}
		});

		if (visibleHeadingIds.length === 0 && headings.length > 0) {
			let closestHeading: string | null = null;
			let minDistance = Number.POSITIVE_INFINITY;

			headings.forEach((heading) => {
				if (heading.id) {
					const rect = heading.getBoundingClientRect();
					const distance = Math.abs(rect.top);
					if (distance < minDistance) {
						minDistance = distance;
						closestHeading = heading.id;
					}
				}
			});

			if (closestHeading) visibleHeadingIds.push(closestHeading);
		}

		return visibleHeadingIds;
	}

	public updateActiveState(): void {
		if (!this.tocItems || this.tocItems.length === 0) return;

		for (const item of this.tocItems) item.classList.remove("visible");

		const visibleHeadingIds = this.getVisibleHeadingIds();

		const activeItems = this.tocItems.filter((item) => {
			const headingId = item.dataset.headingId;
			return headingId && visibleHeadingIds.includes(headingId);
		});

		for (const item of activeItems) item.classList.add("visible");

		this.updateActiveIndicator(activeItems);
	}

	private updateActiveIndicator(activeItems: HTMLElement[]): void {
		const indicator = document.getElementById(this.indicatorId);
		if (!indicator || !this.tocItems.length) return;

		if (activeItems.length === 0) {
			indicator.style.opacity = "0";
			return;
		}

		const tocContent = document.getElementById(this.contentId);
		if (!tocContent) return;

		const contentRect = tocContent.getBoundingClientRect();
		const firstActive = activeItems[0];
		const lastActive = activeItems[activeItems.length - 1];

		const firstRect = firstActive.getBoundingClientRect();
		const lastRect = lastActive.getBoundingClientRect();

		const top = firstRect.top - contentRect.top;
		const height = lastRect.bottom - firstRect.top;

		indicator.style.top = `${top}px`;
		indicator.style.height = `${height}px`;
		indicator.style.opacity = "1";

		if (firstActive) {
			this.scrollToActiveItem(firstActive);
		}
	}

	private scrollToActiveItem(activeItem: HTMLElement): void {
		if (!activeItem) return;

		const tocContainer = document
			.querySelector(`#${this.contentId}`)
			?.closest(".toc-scroll-container");
		if (!tocContainer) return;

		if (this.scrollTimeout) {
			clearTimeout(this.scrollTimeout);
		}

		this.scrollTimeout = window.setTimeout(() => {
			const containerRect = tocContainer.getBoundingClientRect();
			const itemRect = activeItem.getBoundingClientRect();

			const isVisible =
				itemRect.top >= containerRect.top &&
				itemRect.bottom <= containerRect.bottom;

			if (!isVisible) {
				const itemOffsetTop = (activeItem as HTMLElement).offsetTop;
				const containerHeight = tocContainer.clientHeight;
				const itemHeight = activeItem.clientHeight;

				const targetScroll =
					itemOffsetTop - containerHeight / 2 + itemHeight / 2;

				tocContainer.scrollTo({
					top: targetScroll,
					behavior: "smooth",
				});
			}
		}, 100);
	}

	public handleClick(event: Event): void {
		event.preventDefault();
		const target = event.currentTarget as HTMLAnchorElement;
		const id = decodeURIComponent(
			target.getAttribute("href")?.substring(1) || "",
		);
		const targetElement = document.getElementById(id);

		if (targetElement) {
			const targetTop =
				targetElement.getBoundingClientRect().top +
				window.pageYOffset -
				this.scrollOffset;

			window.scrollTo({
				top: targetTop,
				behavior: "smooth",
			});
		}
	}

	public setupObserver(): void {
		const headings = this.getAllHeadings();

		if (this.observer) {
			this.observer.disconnect();
		}

		this.observer = new IntersectionObserver(
			() => {
				this.updateActiveState();
			},
			{
				rootMargin: "0px 0px 0px 0px",
				threshold: 0,
			},
		);

		headings.forEach((heading) => {
			if (heading.id) {
				this.observer?.observe(heading);
			}
		});
	}

	public bindClickEvents(): void {
		this.tocItems.forEach((item) => {
			item.addEventListener("click", this.handleClick.bind(this));
		});
	}

	public cleanup(): void {
		if (this.observer) {
			this.observer.disconnect();
			this.observer = null;
		}
		if (this.scrollTimeout) {
			clearTimeout(this.scrollTimeout);
			this.scrollTimeout = null;
		}
	}

	public init(): void {
		this.updateTOCContent();
		this.bindClickEvents();
		this.setupObserver();
		this.updateActiveState();
	}
}
