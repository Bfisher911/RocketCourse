import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import "./BackgroundGradientAnimation.css";

// Vanilla-CSS port of the Aceternity/shadcn "Background Gradient Animation" component.
// The logic is unchanged from the original; only the styling was moved off Tailwind:
//   - Tailwind utility/arbitrary classes -> plain classes in BackgroundGradientAnimation.css
//   - `cn` from @/lib/utils            -> the small `cx` join helper below
//   - the keyframes from tailwind.config.js -> @keyframes in the same CSS file
// The runtime sets the colour/size/blend CSS variables on <body>, exactly as before.

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" ");

export const BackgroundGradientAnimation = ({
  gradientBackgroundStart = "rgb(108, 0, 162)",
  gradientBackgroundEnd = "rgb(0, 17, 82)",
  firstColor = "18, 113, 255",
  secondColor = "221, 74, 255",
  thirdColor = "100, 220, 255",
  fourthColor = "200, 50, 50",
  fifthColor = "180, 180, 50",
  pointerColor = "140, 100, 255",
  size = "80%",
  blendingValue = "hard-light",
  children,
  className,
  interactive = true,
  containerClassName,
}: {
  gradientBackgroundStart?: string;
  gradientBackgroundEnd?: string;
  firstColor?: string;
  secondColor?: string;
  thirdColor?: string;
  fourthColor?: string;
  fifthColor?: string;
  pointerColor?: string;
  size?: string;
  blendingValue?: string;
  children?: ReactNode;
  className?: string;
  interactive?: boolean;
  containerClassName?: string;
}) => {
  const interactiveRef = useRef<HTMLDivElement>(null);

  const [curX, setCurX] = useState(0);
  const [curY, setCurY] = useState(0);
  const [tgX, setTgX] = useState(0);
  const [tgY, setTgY] = useState(0);
  useEffect(() => {
    document.body.style.setProperty("--gradient-background-start", gradientBackgroundStart);
    document.body.style.setProperty("--gradient-background-end", gradientBackgroundEnd);
    document.body.style.setProperty("--first-color", firstColor);
    document.body.style.setProperty("--second-color", secondColor);
    document.body.style.setProperty("--third-color", thirdColor);
    document.body.style.setProperty("--fourth-color", fourthColor);
    document.body.style.setProperty("--fifth-color", fifthColor);
    document.body.style.setProperty("--pointer-color", pointerColor);
    document.body.style.setProperty("--size", size);
    document.body.style.setProperty("--blending-value", blendingValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function move() {
      if (!interactiveRef.current) {
        return;
      }
      setCurX(curX + (tgX - curX) / 20);
      setCurY(curY + (tgY - curY) / 20);
      interactiveRef.current.style.transform = `translate(${Math.round(curX)}px, ${Math.round(curY)}px)`;
    }

    move();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tgX, tgY]);

  const handleMouseMove = (event: MouseEvent<HTMLDivElement>) => {
    if (interactiveRef.current) {
      const rect = interactiveRef.current.getBoundingClientRect();
      setTgX(event.clientX - rect.left);
      setTgY(event.clientY - rect.top);
    }
  };

  const [isSafari, setIsSafari] = useState(false);
  useEffect(() => {
    setIsSafari(/^((?!chrome|android).)*safari/i.test(navigator.userAgent));
  }, []);

  return (
    <div className={cx("bga-container", containerClassName)}>
      <svg className="bga-hidden">
        <defs>
          <filter id="blurMe">
            <feGaussianBlur in="SourceGraphic" stdDeviation="10" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8"
              result="goo"
            />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>
      <div className={cx(className)}>{children}</div>
      <div className={cx("bga-gradients-container", isSafari ? "bga-blur-safari" : "bga-blur-goo")}>
        <div className="bga-gradient bga-g1"></div>
        <div className="bga-gradient bga-g2"></div>
        <div className="bga-gradient bga-g3"></div>
        <div className="bga-gradient bga-g4"></div>
        <div className="bga-gradient bga-g5"></div>

        {interactive && (
          <div ref={interactiveRef} onMouseMove={handleMouseMove} className="bga-pointer"></div>
        )}
      </div>
    </div>
  );
};
