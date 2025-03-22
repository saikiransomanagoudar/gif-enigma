/**
 * transitions.ts
 * Utility functions for handling UI transitions and animations
 * For use with Tailwind CSS
 */

// Type definitions for transition parameters
type TransitionOptions = {
    duration?: number;
    delay?: number;
    easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
    direction?: 'up' | 'down' | 'left' | 'right';
    distance?: 'sm' | 'md' | 'lg';
    staggerDelay?: number;
    onComplete?: () => void;
  };
  
  // Default transition options
  const defaultOptions: TransitionOptions = {
    duration: 300,
    delay: 0,
    easing: 'ease-out',
    direction: 'up',
    distance: 'md',
    staggerDelay: 100
  };
  
  /**
   * Maps configuration options to Tailwind classes
   */
  const getTailwindClasses = (options: TransitionOptions = {}): {
    initial: string[];
    final: string[];
    transition: string[];
  } => {
    const opts = { ...defaultOptions, ...options };
    
    // Transition classes
    const transitionClasses = [
      'transition-all',
      `duration-${opts.duration}`,
      `ease-${opts.easing}`
    ];
    
    // Initial state classes (hidden)
    let initialClasses = ['opacity-0'];
    
    // Final state classes (visible)
    let finalClasses = ['opacity-100'];
    
    // Add transform classes based on direction and distance
    if (opts.direction) {
      // Map distance option to pixel values
      const distanceMap = {
        sm: 2,
        md: 4,
        lg: 8
      };
      const distance = distanceMap[opts.distance || 'md'];
      
      switch (opts.direction) {
        case 'up':
          initialClasses.push(`translate-y-${distance}`);
          finalClasses.push('translate-y-0');
          break;
        case 'down':
          initialClasses.push(`-translate-y-${distance}`);
          finalClasses.push('translate-y-0');
          break;
        case 'left':
          initialClasses.push(`translate-x-${distance}`);
          finalClasses.push('translate-x-0');
          break;
        case 'right':
          initialClasses.push(`-translate-x-${distance}`);
          finalClasses.push('translate-x-0');
          break;
      }
    }
    
    return {
      initial: initialClasses,
      final: finalClasses,
      transition: transitionClasses
    };
  };
  
  /**
   * Applies transition to a single element
   * @param element - The DOM element to animate
   * @param options - Transition options
   */
  export const animateElement = (
    element: HTMLElement | null,
    options: TransitionOptions = {}
  ): void => {
    if (!element) return;
    
    const opts = { ...defaultOptions, ...options };
    const classes = getTailwindClasses(opts);
    
    // Apply transition classes
    element.classList.add(...classes.transition);
    
    // Set initial state
    element.classList.add(...classes.initial);
    element.classList.remove(...classes.final);
    
    // Force browser to acknowledge the initial state
    void element.offsetWidth;
    
    // Apply final state after specified delay
    setTimeout(() => {
      element.classList.remove(...classes.initial);
      element.classList.add(...classes.final);
      
      // Call onComplete callback after transition ends
      if (opts.onComplete) {
        const transitionDuration = opts.duration || defaultOptions.duration || 300;
        setTimeout(opts.onComplete, transitionDuration);
      }
    }, opts.delay || 0);
  };
  
  /**
   * Prepares an element for animation by setting initial classes
   * @param element - The DOM element to prepare
   * @param options - Transition options
   */
  export const prepareForAnimation = (
    element: HTMLElement | null,
    options: TransitionOptions = {}
  ): void => {
    if (!element) return;
    
    const classes = getTailwindClasses(options);
    element.classList.add(...classes.transition, ...classes.initial);
  };
  
  /**
   * Applies staggered transitions to multiple elements
   * @param selector - CSS selector for the elements to animate
   * @param options - Transition options
   */
  export const staggerElements = (
    selector: string,
    options: TransitionOptions = {}
  ): void => {
    const elements = document.querySelectorAll(selector);
    const opts = { ...defaultOptions, ...options };
    
    elements.forEach((element, index) => {
      const elementOpts = {
        ...opts,
        delay: (opts.delay || 0) + (index * (opts.staggerDelay || 100))
      };
      
      animateElement(element as HTMLElement, elementOpts);
    });
  };
  
  /**
   * Handles page transition between two containers
   * @param currentPage - Current page element to transition out
   * @param nextPage - Next page element to transition in
   * @param options - Transition options
   */
  export const pageTransition = (
    currentPage: HTMLElement | null,
    nextPage: HTMLElement | null,
    options: TransitionOptions = {}
  ): void => {
    if (!currentPage || !nextPage) return;
    
    const opts = { ...defaultOptions, ...options };
    const classes = getTailwindClasses(opts);
    
    // Hide next page initially
    nextPage.classList.add('hidden');
    
    // Transition out current page
    currentPage.classList.add(...classes.transition);
    currentPage.classList.remove(...classes.initial);
    currentPage.classList.add(...classes.initial);
    
    // After current page transitions out
    setTimeout(() => {
      // Hide current page
      currentPage.classList.add('hidden');
      
      // Show next page with initial state
      nextPage.classList.remove('hidden');
      nextPage.classList.add(...classes.transition, ...classes.initial);
      
      // Force browser to acknowledge the initial state
      void nextPage.offsetWidth;
      
      // Transition in next page
      setTimeout(() => {
        nextPage.classList.remove(...classes.initial);
        nextPage.classList.add(...classes.final);
        
        // Call onComplete callback after transition ends
        if (opts.onComplete) {
          const transitionDuration = opts.duration || defaultOptions.duration || 300;
          setTimeout(opts.onComplete, transitionDuration);
        }
      }, 50); // Small delay for better visual effect
    }, opts.duration || 300);
  };
  
  /**
   * Fade in an element
   * @param element - The DOM element to fade in
   * @param options - Transition options
   */
  export const fadeIn = (
    element: HTMLElement | null,
    options: TransitionOptions = {}
  ): void => {
    if (!element) return;
    animateElement(element, {
      ...options,
      direction: undefined // No direction for simple fade
    });
  };
  
  /**
   * Fade out an element
   * @param element - The DOM element to fade out
   * @param options - Transition options
   */
  export const fadeOut = (
    element: HTMLElement | null,
    options: TransitionOptions = {}
  ): void => {
    if (!element) return;
    
    const opts = { ...defaultOptions, ...options };
    const classes = getTailwindClasses(opts);
    
    // Swap initial and final classes for fade out
    element.classList.add(...classes.transition);
    element.classList.add(...classes.final);
    element.classList.remove(...classes.initial);
    
    // Force browser to acknowledge the initial state
    void element.offsetWidth;
    
    // Fade out
    setTimeout(() => {
      element.classList.remove(...classes.final);
      element.classList.add(...classes.initial);
      
      // Call onComplete callback after transition ends
      if (opts.onComplete) {
        const transitionDuration = opts.duration || defaultOptions.duration || 300;
        setTimeout(opts.onComplete, transitionDuration);
      }
    }, opts.delay || 0);
  };
  
  /**
   * Initialize animated elements on page load
   * @param containerSelector - Container element selector that contains elements to animate
   * @param animatedElementSelector - Selector for elements to animate
   * @param options - Transition options
   */
  export const initializeAnimations = (
    containerSelector: string = 'body', 
    animatedElementSelector: string = '[data-animate]',
    options: TransitionOptions = {}
  ): void => {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    
    const elements = container.querySelectorAll(animatedElementSelector);
    
    elements.forEach((element, index) => {
      const el = element as HTMLElement;
      
      // Get animation direction from data attribute or use default
      const direction = el.dataset.direction as TransitionOptions['direction'] || options.direction;
      const delay = parseInt(el.dataset.delay || '0');
      const staggerIndex = parseInt(el.dataset.staggerIndex || index.toString());
      
      // Calculate total delay (base delay + stagger delay * index)
      const totalDelay = (options.delay || 0) + delay + 
                        (staggerIndex * (options.staggerDelay || defaultOptions.staggerDelay || 100));
      
      // Animate with combined options
      animateElement(el, {
        ...options,
        direction,
        delay: totalDelay
      });
    });
  };
  
  /**
   * Handles WebView message events for transitions
   * Used to communicate between Devvit and WebView
   */
  export const setupTransitionMessageHandlers = (): void => {
    window.addEventListener('message', (event) => {
      // Check if this is a message from Devvit
      if (event.data?.type === 'devvit-message') {
        const message = event.data.message;
        
        switch (message?.type) {
          case 'transitionToPage':
            const { from, to } = message.data || {};
            const currentPage = from ? document.getElementById(from) : null;
            const nextPage = to ? document.getElementById(to) : null;
            
            if (currentPage && nextPage) {
              pageTransition(currentPage, nextPage, message.options);
            }
            break;
            
          case 'animateElements':
            const { selector, options } = message.data || {};
            if (selector) {
              staggerElements(selector, options);
            }
            break;
        }
      }
    });
  };
  
  // Export all utilities
  export default {
    animateElement,
    prepareForAnimation,
    staggerElements,
    pageTransition,
    fadeIn,
    fadeOut,
    initializeAnimations,
    setupTransitionMessageHandlers
  };