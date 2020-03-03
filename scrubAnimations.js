import { getElementRect } from './domMeasurements.js';
import { onReady, getWindowSize, getWindowScroll, isMobile } from './utils.js';

/**
 * Window dimensions in pixels
 * @typedef {Object} WindowDimensions
 * @property {Number} x scrollX
 * @property {Number} y scrollY
 * @property {Number} width
 * @property {Number} height
 */

/**
 * Parameters of element animations.
 * @mixes DomDimensions
 * @typedef {Object} ElementAnimationParameters
 * @property {Number} top
 * @property {Number} left
 * @property {Number} bottom
 * @property {Number} right
 * @property {Number} width
 * @property {Number} height
 * @property {String} effect
 * @property {String} [*]
 */

/**
 * Manage page animations and throttle scroll
 * @param {HTMLElement} root The fixed element to use as a scroll parent
 */
class ScrubEffects {
  constructor(root) {
    // Flag to know if animation already requested
    this.nextFrameCallbackId = undefined;
    // Store for elements that should animate
    this.elementsWithEffectsMap = [];
    // The animation root scrollable component
    this.root = root;

    // Wait for document ready
    onReady(() => {
      // On scroll do all the things
      window.addEventListener('scroll', () => this.registerNextAF());
      // On resize init again
      window.addEventListener('resize', () => this.init());
      // Calculate and initialize scroll position
      this.init();
    });
  }

  /**
   * Initialize the animations
   * - Measure window and scroll
   * - Measure animatable comps positioning info
   * - Set initial scroll
   * - Call animations for initial viewport
   */
  init() {
    const windowScrollAndSize = { ...getWindowSize(), ...getWindowScroll() };
    this.elementsWithEffectsMap = this.getElementsWithEffects();
    this.initDocument();
    this.propagateScroll(windowScrollAndSize);
    this.registerNextAF();
  }

  /**
   * Set body height and make root fixed
   */
  initDocument() {
    // Set body height
    document.body.style.height = `${this.root.scrollHeight}px`;
    // Add scroll class to root
    this.root.classList.add('scrub-root');
  }

  /**
   * Collect animatable elements
   * - measure the elements while ignoring transformations
   * - data-effect is the effect name "doAnimations()" should handle
   * - data-* are animation parameters to expose
   * @returns {Map<HTMLElement, ElementAnimationParameters>}
   */
  getElementsWithEffects() {
    const elements = this.root.querySelectorAll('[data-effect]');
    const entries = [...elements].map(element => [
      element,
      {
        ...getElementRect(element, this.root),
        ...element.dataset
      }
    ]);

    return new Map(entries);
  }

  /**
   * Throttle and debounce scroll and animations to next animation frame
   */
  registerNextAF() {
    if (!this.nextFrameCallbackId) {
      this.nextFrameCallbackId = requestAnimationFrame(() => {
        // Remeasure scroll and size closer to animation
        // Will cause layout thrashing, but I think it is the right place for it
        // see this gist by Paul Irish: https://gist.github.com/paulirish/5d52fb081b3570c81e3a
        const windowScrollAndSize = { ...getWindowSize(), ...getWindowScroll() };
        // Scroll...
        this.propagateScroll(windowScrollAndSize);
        // ...then animate
        this.applyEffects(windowScrollAndSize);
        // Release debounce flag
        this.nextFrameCallbackId = undefined;
      });
    }
  }

  /**
   * Logic to execute animations.
   * Supported effects:
   * - parallax: will apply a parallax effect on the first child of an element (speed 0..1)
   * - screen-in: TBD
   * @param {WindowDimensions} windowDimensions
   */
  applyEffects(windowDimensions) {
    this.elementsWithEffectsMap.forEach((params, element) => {
      switch (params.effect) {
        /**
         * 'parallax':
         * bg - the first child of a strip
         * top - the element top
         * speed - a number between 1 to 0 to indicate parallax speed, where 0 is static and 1 is fixed
         */
        case 'parallax': {
          const bg = element.firstElementChild;
          const { top, speed } = params;
          const distance = (windowDimensions.y - top) * speed;
          bg.style.transform = `translateY(${distance}px)`;
          break;
        }
        /**
         * 'slide-in':
         * direction - slide from [top, left, bottom, right]
         * top - the element top
         * left - the element left
         * bottom - the element bottom
         * right - the element right
         * threshold - a number between 1 to 0 to indicate where in the viewport the element should be back in its place, where 0 is bottom and 1 is top
         */
        case 'slide-in': {
          const { top, left, bottom, right, direction, threshold } = params;
          switch (direction) {
            case 'right': {
              const distance = windowDimensions.width - right; // distance to travel
              const end = windowDimensions.height * threshold; // the y position where element should be with translateX(0)
              const current = windowDimensions.y + windowDimensions.height- top; // the current y position of the element
              const progress = Math.min(current / end, 1) // the percent of the animation we should be in, normalized
              element.style.transform = `translateX(${distance * (1 - progress)}px)`;
              break;
            }
          }
          break;
        }
      }
    });
  }

  /**
   * Pass scroll position to root element
   * @param {WindowDimensions} params
   */
  propagateScroll({ x, y }) {
    this.root.scrollTop = y;
    this.root.scrollLeft = x;
  }
}
window.scrubEffects = new ScrubEffects(document.getElementById('root'));
