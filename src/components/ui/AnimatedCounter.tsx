import type { FC } from '../../lib/teact/teact';
import React, { memo, useMemo, useRef } from '../../lib/teact/teact';

import { ANIMATION_LEVEL_MAX } from '../../config';
import { getGlobal } from '../../global';

import useForceUpdate from '../../hooks/useForceUpdate';
import useLang from '../../hooks/useLang';
import usePrevious from '../../hooks/usePrevious';
import useTimeout from '../../hooks/useTimeout';

import styles from './AnimatedCounter.module.scss';

type OwnProps = {
  text: string;
};

const ANIMATION_TIME = 200;

const AnimatedCounter: FC<OwnProps> = ({
  text,
}) => {
  const lang = useLang();

  const prevText = usePrevious(text);
  const forceUpdate = useForceUpdate();

  const isAnimatingRef = useRef(false);

  const shouldAnimate = getGlobal().settings.animationLevel === ANIMATION_LEVEL_MAX;

  const textElement = useMemo(() => {
    if (!shouldAnimate) return text;

    const elements = [];
    for (let i = 0; i < text.length; i++) {
      if (prevText && text[i] !== prevText[i]) {
        elements.push(
          <div className={styles.characterContainer}>
            <div className={styles.character}>{text[i]}</div>
            <div className={styles.characterOld}>{prevText[i]}</div>
            <div className={styles.characterNew}>{text[i]}</div>
          </div>,
        );
      } else {
        elements.push(<span>{text[i]}</span>);
      }
    }

    isAnimatingRef.current = true;

    return elements;
  }, [prevText, shouldAnimate, text]);

  useTimeout(() => {
    isAnimatingRef.current = false;
    forceUpdate();
  }, isAnimatingRef.current ? ANIMATION_TIME : undefined);

  return (
    <span className={styles.root} dir={lang.isRtl ? 'rtl' : undefined}>
      {textElement}
    </span>
  );
};

export default memo(AnimatedCounter);
