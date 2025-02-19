import type { RefObject } from 'react';
import { requestForcedReflow, requestMutation } from '../../lib/fasterdom/fasterdom';
import React, { useEffect, useLayoutEffect, useRef } from '../../lib/teact/teact';
import { addExtraClass, removeExtraClass, toggleExtraClass } from '../../lib/teact/teact-dom';

import type { GlobalState } from '../../global/types';

import { ANIMATION_LEVEL_MIN } from '../../config';
import { getGlobal } from '../../global';
import buildClassName from '../../util/buildClassName';
import { waitForAnimationEnd, waitForTransitionEnd } from '../../util/cssAnimationEndListeners';
import forceReflow from '../../util/forceReflow';

import useForceUpdate from '../../hooks/useForceUpdate';
import { dispatchHeavyAnimationEvent } from '../../hooks/useHeavyAnimationCheck';
import usePrevious from '../../hooks/usePrevious';

import './Transition.scss';

type AnimationName = (
  'none' | 'slide' | 'slideRtl' | 'slideFade' | 'zoomFade' | 'slideLayers'
  | 'fade' | 'pushSlide' | 'reveal' | 'slideOptimized' | 'slideOptimizedRtl' | 'semiFade'
  | 'slideVertical' | 'slideVerticalFade'
  );
export type ChildrenFn = (isActive: boolean, isFrom: boolean, currentKey: number) => React.ReactNode;
export type TransitionProps = {
  ref?: RefObject<HTMLDivElement>;
  activeKey: number;
  nextKey?: number;
  name: AnimationName;
  direction?: 'auto' | 'inverse' | 1 | -1;
  renderCount?: number;
  shouldRestoreHeight?: boolean;
  shouldCleanup?: boolean;
  cleanupExceptionKey?: number;
  // Used by async components which are usually remounted during first animation
  shouldWrap?: boolean;
  wrapExceptionKey?: number;
  id?: string;
  className?: string;
  slideClassName?: string;
  onStart?: NoneToVoidFunction;
  onStop?: NoneToVoidFunction;
  children: React.ReactNode | ChildrenFn;
};

const FALLBACK_ANIMATION_END = 1000;
const CLASSES = {
  slide: 'Transition_slide',
  active: 'Transition_slide-active',
  from: 'Transition_slide-from',
  to: 'Transition_slide-to',
  inactive: 'Transition_slide-inactive',
};

export const ACTIVE_SLIDE_CLASS_NAME = CLASSES.active;
export const TO_SLIDE_CLASS_NAME = CLASSES.to;

function Transition({
  ref,
  activeKey,
  nextKey,
  name,
  direction = 'auto',
  renderCount,
  shouldRestoreHeight,
  shouldCleanup,
  cleanupExceptionKey,
  shouldWrap,
  wrapExceptionKey,
  id,
  className,
  slideClassName,
  onStart,
  onStop,
  children,
}: TransitionProps) {
  const currentKeyRef = useRef<number>();
  // No need for a container to update on change
  const { animationLevel } = getGlobal().settings;

  // eslint-disable-next-line no-null/no-null
  let containerRef = useRef<HTMLDivElement>(null);
  if (ref) {
    containerRef = ref;
  }

  const rendersRef = useRef<Record<number, React.ReactNode | ChildrenFn>>({});
  const prevActiveKey = usePrevious<any>(activeKey);
  const forceUpdate = useForceUpdate();

  const activeKeyChanged = prevActiveKey !== undefined && activeKey !== prevActiveKey;

  if (!renderCount && activeKeyChanged) {
    rendersRef.current = { [prevActiveKey]: rendersRef.current[prevActiveKey] };
  }

  rendersRef.current[activeKey] = children;
  if (nextKey) {
    rendersRef.current[nextKey] = children;
  }

  const isBackwards = (
    direction === -1
    || (direction === 'auto' && prevActiveKey > activeKey)
    || (direction === 'inverse' && prevActiveKey < activeKey)
  );

  useLayoutEffect(() => {
    function cleanup() {
      if (!shouldCleanup) {
        return;
      }

      const preservedRender = cleanupExceptionKey !== undefined ? rendersRef.current[cleanupExceptionKey] : undefined;

      rendersRef.current = preservedRender ? { [cleanupExceptionKey!]: preservedRender } : {};

      forceUpdate();
    }

    const isSlideOptimized = name === 'slideOptimized' || name === 'slideOptimizedRtl';
    const container = containerRef.current!;
    const keys = Object.keys(rendersRef.current).map(Number);
    const prevActiveIndex = renderCount ? prevActiveKey : keys.indexOf(prevActiveKey);
    const activeIndex = renderCount ? activeKey : keys.indexOf(activeKey);
    const nextIndex = nextKey ? (renderCount ? nextKey : keys.indexOf(nextKey)) : -1;

    const childNodes = Array.from(container.childNodes);
    if (!childNodes.length) {
      return;
    }

    const childElements = Array.from(container.children) as HTMLElement[];
    childElements.forEach((el) => {
      addExtraClass(el, CLASSES.slide);

      if (slideClassName) {
        addExtraClass(el, slideClassName);
      }
    });

    if (!activeKeyChanged) {
      const activeChild = childNodes[activeIndex] as HTMLElement;
      addExtraClass(activeChild, CLASSES.active);

      if (isSlideOptimized) {
        activeChild.style.transition = 'none';
        activeChild.style.transform = 'translate3d(0, 0, 0)';
      }

      const nextChild = nextIndex !== -1 && nextIndex !== activeIndex && childNodes[nextIndex] as HTMLElement;
      if (nextChild) {
        addExtraClass(nextChild, CLASSES.inactive);
      }

      return;
    }

    currentKeyRef.current = activeKey;

    if (isSlideOptimized) {
      performSlideOptimized(
        animationLevel,
        name,
        isBackwards,
        cleanup,
        activeKey,
        currentKeyRef,
        container,
        childNodes[activeIndex],
        childNodes[prevActiveIndex],
        shouldRestoreHeight,
        onStart,
        onStop,
      );

      return;
    }

    if (name === 'none' || animationLevel === ANIMATION_LEVEL_MIN) {
      childNodes.forEach((node, i) => {
        if (node instanceof HTMLElement) {
          removeExtraClass(node, CLASSES.from);
          removeExtraClass(node, CLASSES.to);
          toggleExtraClass(node, CLASSES.active, i === activeIndex);
          toggleExtraClass(node, CLASSES.inactive, i !== activeIndex);
        }
      });

      cleanup();

      return;
    }

    childNodes.forEach((node, i) => {
      if (node instanceof HTMLElement) {
        removeExtraClass(node, CLASSES.active);
        toggleExtraClass(node, CLASSES.from, i === prevActiveIndex);
        toggleExtraClass(node, CLASSES.to, i === activeIndex);
        toggleExtraClass(node, CLASSES.inactive, i !== prevActiveIndex && i !== activeIndex);
      }
    });

    const dispatchHeavyAnimationStop = dispatchHeavyAnimationEvent();
    onStart?.();

    toggleExtraClass(container, `Transition-${name}`, !isBackwards);
    toggleExtraClass(container, `Transition-${name}Backwards`, isBackwards);

    function onAnimationEnd() {
      const activeElement = container.querySelector<HTMLDivElement>(`.${CLASSES.active}`);
      const { clientHeight } = activeElement || {};

      requestMutation(() => {
        if (activeKey !== currentKeyRef.current) {
          return;
        }

        removeExtraClass(container, `Transition-${name}`);
        removeExtraClass(container, `Transition-${name}Backwards`);

        childNodes.forEach((node, i) => {
          if (node instanceof HTMLElement) {
            removeExtraClass(node, CLASSES.from);
            removeExtraClass(node, CLASSES.to);
            toggleExtraClass(node, CLASSES.active, i === activeIndex);
            toggleExtraClass(node, CLASSES.inactive, i !== activeIndex);
          }
        });

        if (shouldRestoreHeight) {
          if (activeElement) {
            activeElement.style.height = 'auto';
            container.style.height = `${clientHeight}px`;
          }
        }

        onStop?.();
        dispatchHeavyAnimationStop();

        cleanup();
      });
    }

    const watchedNode = name === 'reveal' && isBackwards
      ? childNodes[prevActiveIndex]
      : childNodes[activeIndex];

    if (watchedNode) {
      waitForAnimationEnd(watchedNode, onAnimationEnd, undefined, FALLBACK_ANIMATION_END);
    } else {
      onAnimationEnd();
    }
  }, [
    activeKey,
    nextKey,
    prevActiveKey,
    activeKeyChanged,
    isBackwards,
    name,
    onStart,
    onStop,
    renderCount,
    shouldRestoreHeight,
    shouldCleanup,
    slideClassName,
    cleanupExceptionKey,
    animationLevel,
    forceUpdate,
  ]);

  useEffect(() => {
    if (!shouldRestoreHeight) {
      return;
    }

    const container = containerRef.current!;
    const activeElement = container.querySelector<HTMLDivElement>(`.${CLASSES.active}`)
      || container.querySelector<HTMLDivElement>(`.${CLASSES.from}`);
    if (!activeElement) {
      return;
    }

    const { clientHeight } = activeElement || {};
    if (!clientHeight) {
      return;
    }

    requestMutation(() => {
      activeElement.style.height = 'auto';
      container.style.height = `${clientHeight}px`;
      container.style.flexBasis = `${clientHeight}px`;
    });
  }, [shouldRestoreHeight, children]);

  const asFastList = !renderCount;
  const renders = rendersRef.current;
  const renderKeys = Object.keys(renderCount ? new Array(renderCount).fill(undefined) : renders).map(Number);
  const contents = renderKeys.map((key) => {
    const render = renders[key];
    if (!render) {
      return undefined;
    }

    const rendered = typeof render === 'function' ? render(key === activeKey, key === prevActiveKey, key) : render;

    return (shouldWrap && key !== wrapExceptionKey) || asFastList ? (
      <div key={key} teactOrderKey={key}>
        {rendered}
      </div>
    ) : (
      rendered
    );
  });

  return (
    <div
      ref={containerRef}
      id={id}
      className={buildClassName('Transition', className)}
      teactFastList={asFastList}
    >
      {contents}
    </div>
  );
}

export default Transition;

function performSlideOptimized(
  animationLevel: GlobalState['settings']['animationLevel'],
  name: 'slideOptimized' | 'slideOptimizedRtl',
  isBackwards: boolean,
  cleanup: NoneToVoidFunction,
  activeKey: number,
  currentKeyRef: { current: number | undefined },
  container: HTMLElement,
  toSlide: ChildNode,
  fromSlide?: ChildNode,
  shouldRestoreHeight?: boolean,
  onStart?: NoneToVoidFunction,
  onStop?: NoneToVoidFunction,
) {
  if (animationLevel === ANIMATION_LEVEL_MIN) {
    toggleExtraClass(container, `Transition-${name}`, !isBackwards);
    toggleExtraClass(container, `Transition-${name}Backwards`, isBackwards);

    if (fromSlide instanceof HTMLElement) {
      fromSlide.style.transition = 'none';
      fromSlide.style.transform = '';
      removeExtraClass(fromSlide, CLASSES.active);
    }

    if (toSlide instanceof HTMLElement) {
      toSlide.style.transition = 'none';
      toSlide.style.transform = 'translate3d(0, 0, 0)';
      addExtraClass(toSlide, CLASSES.active);
    }

    cleanup();

    return;
  }

  if (name === 'slideOptimizedRtl') {
    isBackwards = !isBackwards;
  }

  const dispatchHeavyAnimationStop = dispatchHeavyAnimationEvent();

  onStart?.();

  toggleExtraClass(container, `Transition-${name}`, !isBackwards);
  toggleExtraClass(container, `Transition-${name}Backwards`, isBackwards);

  if (fromSlide instanceof HTMLElement) {
    fromSlide.style.transition = 'none';
    fromSlide.style.transform = 'translate3d(0, 0, 0)';
  }

  if (toSlide instanceof HTMLElement) {
    toSlide.style.transition = 'none';
    toSlide.style.transform = `translate3d(${isBackwards ? '-' : ''}100%, 0, 0)`;
  }

  requestForcedReflow(() => {
    if (toSlide instanceof HTMLElement) {
      forceReflow(toSlide);
    }

    return () => {
      if (fromSlide instanceof HTMLElement) {
        fromSlide.style.transition = '';
        fromSlide.style.transform = `translate3d(${isBackwards ? '' : '-'}100%, 0, 0)`;
        removeExtraClass(fromSlide, CLASSES.active);
      }

      if (toSlide instanceof HTMLElement) {
        toSlide.style.transition = '';
        toSlide.style.transform = 'translate3d(0, 0, 0)';
        addExtraClass(toSlide, CLASSES.active);
      }
    };
  });

  waitForTransitionEnd(toSlide, () => {
    const clientHeight = toSlide instanceof HTMLElement ? toSlide.clientHeight : undefined;

    requestMutation(() => {
      if (activeKey !== currentKeyRef.current) {
        return;
      }

      if (fromSlide instanceof HTMLElement) {
        fromSlide.style.transition = 'none';
        fromSlide.style.transform = '';
      }

      if (shouldRestoreHeight && clientHeight && toSlide instanceof HTMLElement) {
        toSlide.style.height = 'auto';
        container.style.height = `${clientHeight}px`;
      }

      onStop?.();
      dispatchHeavyAnimationStop();
      cleanup();
    });
  });
}
