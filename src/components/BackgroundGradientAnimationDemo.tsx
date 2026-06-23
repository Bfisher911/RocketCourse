import { BackgroundGradientAnimation } from "./BackgroundGradientAnimation";

// Example usage, ported from the provided demo.tsx. The overlay styling (centered,
// responsive, gradient-clipped text) lives in BackgroundGradientAnimation.css as
// `.bga-demo-overlay` instead of Tailwind utilities.
export function BackgroundGradientAnimationDemo() {
  return (
    <BackgroundGradientAnimation>
      <div className="bga-demo-overlay">
        <p>Gradients X Animations</p>
      </div>
    </BackgroundGradientAnimation>
  );
}
