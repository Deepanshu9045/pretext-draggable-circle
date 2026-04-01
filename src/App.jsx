import { useEffect, useMemo, useRef, useState } from "react";
import { layoutNextLine, prepareWithSegments } from "@chenglou/pretext";

const FONT = '400 20px Georgia, "Times New Roman", serif';
const LINE_HEIGHT = 34;
const PADDING = 32;
const PARAGRAPH_GAP = 22;
const CIRCLE_RADIUS = 92;
const TEXT_GAP_AROUND_CIRCLE = 18;
const MIN_SLOT_WIDTH = 96;

const PARAGRAPHS = [
  "The web usually learns where text should sit only after the DOM has been created and measured. Pretext flips that workflow around. It segments the copy, measures it with the browser's font engine, and lets you decide how each line should flow before the paragraph ever touches the page.",
  "This demo keeps the UI simple: drag the glowing circle and the article re-routes around it in real time. React manages the interaction state, while Pretext lays out the text line by line. That gives you a lightweight editorial-style effect without relying on repeated text measurements from the DOM.",
  "You can use the same pattern for dashboards, magazine sections, annotations, floating artwork, product stories, or interactive explainers. The key idea is that the shape moves, the available line widths change, and the text can still be recomputed smoothly from cached segment widths."
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function useElementWidth(ref) {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setWidth(entry.contentRect.width);
    });

    observer.observe(node);
    setWidth(node.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, [ref]);

  return width;
}

function App() {
  const surfaceRef = useRef(null);
  const dragRef = useRef(null);
  const surfaceWidth = useElementWidth(surfaceRef);

  const preparedParagraphs = useMemo(
    () => PARAGRAPHS.map((paragraph) => prepareWithSegments(paragraph, FONT)),
    []
  );

  const [circle, setCircle] = useState({
    x: 520,
    y: 210,
    r: CIRCLE_RADIUS,
  });

  const layoutResult = useMemo(() => {
    const width = Math.max(0, surfaceWidth - PADDING * 2);

    if (!width) {
      return { pieces: [], contentHeight: 520 };
    }

    const pieces = [];
    let y = 0;

    preparedParagraphs.forEach((prepared, paragraphIndex) => {
      let cursor = { segmentIndex: 0, graphemeIndex: 0 };

      while (true) {
        const rowCenter = y + LINE_HEIGHT / 2;
        const dy = rowCenter - circle.y;
        let placedAnyPiece = false;
        let paragraphFinished = false;

        if (Math.abs(dy) < circle.r) {
          const halfChord = Math.sqrt(circle.r * circle.r - dy * dy);
          const leftWidth = Math.max(0, circle.x - halfChord - TEXT_GAP_AROUND_CIRCLE);
          const rightStart = Math.min(
            width,
            circle.x + halfChord + TEXT_GAP_AROUND_CIRCLE
          );
          const rightWidth = Math.max(0, width - rightStart);

          const slots = [];
          if (leftWidth >= MIN_SLOT_WIDTH) {
            slots.push({ x: 0, width: leftWidth });
          }
          if (rightWidth >= MIN_SLOT_WIDTH) {
            slots.push({ x: rightStart, width: rightWidth });
          }

          if (slots.length === 0) {
            y += LINE_HEIGHT;
            continue;
          }

          for (const slot of slots) {
            const line = layoutNextLine(prepared, cursor, slot.width);

            if (line === null) {
              paragraphFinished = true;
              break;
            }

            pieces.push({
              key: `${paragraphIndex}-${y}-${slot.x}-${pieces.length}`,
              text: line.text,
              x: slot.x,
              y,
            });

            cursor = line.end;
            placedAnyPiece = true;
          }

          if (paragraphFinished) {
            break;
          }
        }

        if (!placedAnyPiece) {
          const line = layoutNextLine(prepared, cursor, width);

          if (line === null) {
            break;
          }

          pieces.push({
            key: `${paragraphIndex}-${y}-full-${pieces.length}`,
            text: line.text,
            x: 0,
            y,
          });

          cursor = line.end;
        }

        y += LINE_HEIGHT;
      }

      if (paragraphIndex < preparedParagraphs.length - 1) {
        y += PARAGRAPH_GAP;
      }
    });

    return {
      pieces,
      contentHeight: Math.max(520, y + 32),
    };
  }, [circle.x, circle.y, circle.r, preparedParagraphs, surfaceWidth]);

  const surfaceHeight = Math.max(560, layoutResult.contentHeight + PADDING * 2);
  const innerWidth = Math.max(0, surfaceWidth - PADDING * 2);
  const innerHeight = Math.max(0, surfaceHeight - PADDING * 2);

  useEffect(() => {
    if (!innerWidth || !innerHeight) return;

    setCircle((current) => {
      const next = {
        ...current,
        x: clamp(current.x, current.r, Math.max(current.r, innerWidth - current.r)),
        y: clamp(current.y, current.r, Math.max(current.r, innerHeight - current.r)),
      };

      if (next.x === current.x && next.y === current.y) {
        return current;
      }

      return next;
    });
  }, [innerWidth, innerHeight]);

  const startDrag = (event) => {
    event.preventDefault();
    const surface = surfaceRef.current;
    if (!surface) return;

    const rect = surface.getBoundingClientRect();
    dragRef.current = {
      offsetX: event.clientX - rect.left - PADDING - circle.x,
      offsetY: event.clientY - rect.top - PADDING - circle.y,
    };
  };

  useEffect(() => {
    const handleMove = (event) => {
      if (!dragRef.current || !surfaceRef.current) return;

      const rect = surfaceRef.current.getBoundingClientRect();
      const nextX =
        event.clientX - rect.left - PADDING - dragRef.current.offsetX;
      const nextY =
        event.clientY - rect.top - PADDING - dragRef.current.offsetY;

      setCircle((current) => ({
        ...current,
        x: clamp(nextX, current.r, Math.max(current.r, innerWidth - current.r)),
        y: clamp(nextY, current.r, Math.max(current.r, innerHeight - current.r)),
      }));
    };

    const stopDrag = () => {
      dragRef.current = null;
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", stopDrag);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", stopDrag);
    };
  }, [innerHeight, innerWidth]);

  return (
    <div className="page-shell">
      <main className="page">
        <section className="hero">
          <p className="eyebrow">React + Pretext</p>
          <h1>Draggable circle with live text reflow</h1>
          <p className="intro">
            This starter project uses React for interaction and{" "}
            <code>@chenglou/pretext</code> for manual text layout. Drag the orb
            inside the frame and the article will route around it in real time.
          </p>
        </section>

        <section className="surface-card">
          <div className="surface-topbar">
            <span>Move the orb to change the available line widths.</span>
            <span>No DOM text measurements required.</span>
          </div>

          <div
            ref={surfaceRef}
            className="editorial-surface"
            style={{ height: surfaceHeight }}
          >
            <div className="texture texture-a" />
            <div className="texture texture-b" />
            <div className="texture texture-c" />

            <div className="lines-layer">
              {layoutResult.pieces.map((piece) => (
                <div
                  key={piece.key}
                  className="line"
                  style={{
                    left: PADDING + piece.x,
                    top: PADDING + piece.y,
                  }}
                >
                  {piece.text}
                </div>
              ))}
            </div>

            <button
              type="button"
              className="orb"
              aria-label="Drag the circle"
              onPointerDown={startDrag}
              style={{
                width: circle.r * 2,
                height: circle.r * 2,
                left: PADDING + circle.x - circle.r,
                top: PADDING + circle.y - circle.r,
              }}
            >
              <span />
            </button>
          </div>
        </section>

        <section className="notes">
          <article className="note">
            <h2>How it works</h2>
            <p>
              Each paragraph is prepared once with Pretext. On every drag
              update, the app asks for the next line with a width that depends on
              the orb's current position.
            </p>
          </article>

          <article className="note">
            <h2>Why it is useful</h2>
            <p>
              This pattern is useful when text should respond to floating media,
              annotations, cards, or any custom shape that changes layout at
              runtime.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}

export default App;
