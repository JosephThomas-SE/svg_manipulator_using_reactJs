import React, { useState, useEffect, useRef, useCallback } from 'react';
import { fabric } from 'fabric';
import './App.css';

// Define an ErrorBoundary component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    // Update state to indicate an error has occurred
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can log the error to an error reporting service
    console.error('Error caught by error boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // You can render a fallback UI here
      return <h1>Something went wrong.</h1>;
    }

    // Render children normally if no error occurred
    return this.props.children;
  }
}

// Wrap your App component with the ErrorBoundary
const AppWithBoundary = () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

function App() {
  const [svgData, setSvgData] = useState(null);
  const [scaleFactor, setScaleFactor] = useState(1);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [translation, setTranslation] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const svgContainerRef = useRef(null);
  const canvasRef = useRef(null);
  const isDrawingModeRef = useRef(false);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSvgData(e.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleElementTransform = (transformType, value) => {
    const activeObject = canvasRef.current.getActiveObject();
    if (!activeObject) return;

    switch (transformType) {
      case "scale":
        activeObject.scaleX = value;
        activeObject.scaleY = value;
        break;
      case "rotate":
        activeObject.angle = value;
        break;
      case "translate":
        activeObject.set({ left: value.x, top: value.y });
        break;
      default:
        console.error("Invalid action");
    }

    canvasRef.current.renderAll();
  };

  const adjustCanvasSize = () => {
    const scaledWidth = window.innerWidth;
    const scaledHeight = window.innerHeight;
    canvasRef.current.setWidth(scaledWidth);
    canvasRef.current.setHeight(scaledHeight);
    canvasRef.current.renderAll();
  };

  const toggleDrawingMode = () => {
    isDrawingModeRef.current = !isDrawingModeRef.current;
    if (canvasRef.current) {
      canvasRef.current.isDrawingMode = isDrawingModeRef.current;
    }
  };

  const handleMouseMove = useCallback((event) => {
    if (!dragging) return;
    const dx = event.clientX - dragStart.x;
    const dy = event.clientY - dragStart.y;
    setTranslation((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
    setDragStart({ x: event.clientX, y: event.clientY });
  }, [dragging, dragStart, setTranslation]);

  useEffect(() => {
    const handlePathEdit = (pathData) => {
      const activeObject = canvasRef.current.getActiveObject();
      if (activeObject && activeObject.type === 'path') {
        activeObject.set({ path: pathData });
        canvasRef.current.renderAll();
      }
    };

    const canvasInstance = new fabric.Canvas(canvasRef.current, {
      backgroundColor: "#f0f0f0",
    });
    canvasRef.current = canvasInstance;

    canvasInstance.isDrawingMode = isDrawingModeRef.current;
    canvasInstance.freeDrawingBrush.width = 5;
    canvasInstance.freeDrawingBrush.color = "black";

    canvasInstance.on("mouse:down", (e) => {
      canvasInstance.isDrawingMode = true;
      canvasInstance.freeDrawingBrush.width = 5;
      canvasInstance.freeDrawingBrush.color = "black";
    });

    canvasInstance.on("mouse:up", (e) => {
      canvasInstance.isDrawingMode = false;
    });

    canvasInstance.on("mouse:move", (e) => {
      if (canvasInstance.isDrawingMode) {
        const activeObject = canvasInstance.getActiveObject();
        if (activeObject && activeObject.type === "path") {
          const newPathData = activeObject.path.reduce((acc, point) => {
            return acc + point.join(" ") + " ";
          }, "");
          handlePathEdit(newPathData);
        }
      }
    });

    canvasInstance.on("object:added", (e) => {
      setUndoStack((undoStack) => {
        if (undoStack.length > 15) {
          undoStack.shift();
        }
        return [...undoStack, e.target];
      });
    });

    canvasInstance.on("object:removed", (e) => {
      setRedoStack((redoStack) => [...redoStack, e.target]);
    });

    const handleKeyDown = (event) => {
      const step = 1;
      switch (event.key) {
        case "ArrowUp":
          setTranslation((prev) => ({ ...prev, y: prev.y - step }));
          break;
        case "ArrowDown":
          setTranslation((prev) => ({ ...prev, y: prev.y + step }));
          break;
        case "ArrowLeft":
          setTranslation((prev) => ({ ...prev, x: prev.x - step }));
          break;
        case "ArrowRight":
          setTranslation((prev) => ({ ...prev, x: prev.x + step }));
          break;
        case "+":
          setScaleFactor((prev) => prev + 0.1);
          break;
        case "-":
          setScaleFactor((prev) => prev - 0.1);
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      canvasInstance.dispose();
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleMouseMove]);

  const handleUndo = () => {
    if (undoStack.length > 0) {
      const lastObject = undoStack.pop();
      canvasRef.current.remove(lastObject);
      setRedoStack([...redoStack, lastObject]);
      setUndoStack(undoStack);
    }
  };

  const handleRedo = () => {
    if (redoStack.length > 0) {
      const lastObject = redoStack.pop();
      canvasRef.current.add(lastObject);
      setUndoStack([...undoStack, lastObject]);
      setRedoStack(redoStack);
    }
  };

  const handleMouseDown = (event) => {
    setDragging(true);
    setDragStart({ x: event.clientX, y
      : event.clientY });
    };
  
    const handleMouseUp = () => {
      setDragging(false);
    };
  
    useEffect(() => {
      const svgContainer = svgContainerRef.current;
      if (svgContainer) {
        svgContainer.addEventListener("mousedown", handleMouseDown);
        svgContainer.addEventListener("mousemove", (event) => handleMouseMove(event));
        svgContainer.addEventListener("mouseup", handleMouseUp);
        svgContainer.addEventListener("mouseleave", handleMouseUp);
  
        svgContainer.style.transform = `scale(${scaleFactor})`;
  
        return () => {
          svgContainer.removeEventListener("mousedown", handleMouseDown);
          svgContainer.removeEventListener("mousemove", (event) =>
            handleMouseMove(event)
          );
          svgContainer.removeEventListener("mouseup", handleMouseUp);
          svgContainer.removeEventListener("mouseleave", handleMouseUp);
        };
      }
    }, [scaleFactor, handleMouseMove]);
  
    const handleExport = () => {
      if (canvasRef.current) {
        const svg = canvasRef.current.toSVG();
        const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "canvas.svg";
        link.click();
      }
    };
  
    return (
      <div className="App">
        <input type="file" accept=".svg" onChange={handleFileUpload} />
        {svgData && (
          <>
            <div
              id="svg-container"
              style={{ transform: `scale(${scaleFactor}) rotate(${rotationAngle}deg) translate(${translation.x}px, ${translation.y}px)`,}}>
              <img src={svgData} alt="SVG" />
            </div>
            <div className="controls-container">
              <label htmlFor="scale">Scale:</label>
              <input
                type="number"
                id="scale"
                min="0.1"
                max="2"
                step="0.1"
                value={scaleFactor}
                onChange={(e) => {
                  const newScale = parseFloat(e.target.value);
                  const actualScale = newScale * 100;
                  setScaleFactor(newScale);
                  handleElementTransform("scale", actualScale);
                  adjustCanvasSize();
                }}
              />
              <label htmlFor="rotate">Rotate:</label>
              <input
                type="number"
                id="rotate"
                min="0"
                max="360"
                step="1"
                value={rotationAngle}
                onChange={(e) => {
                  const newAngle = parseFloat(e.target.value);
                  setRotationAngle(newAngle);
                  handleElementTransform("rotate", newAngle);
                }}
              />
              <label htmlFor="translateX">Translate X:</label>
              <input
                type="number"
                id="translateX"
                value={translation.x}
                onChange={(e) => {
                  const newX = parseFloat(e.target.value);
                  setTranslation((prev) => ({ ...prev, x: newX }));
                  handleElementTransform("translate", { x: newX, y: translation.y });
                }}
              />
              <label htmlFor="translateY">Translate Y:</label>
              <input
                type="number"
                id="translateY"
                value={translation.y}
                onChange={(e) => {
                  const newY = parseFloat(e.target.value);
                  setTranslation((prev) => ({ ...prev, y: newY }));
                  handleElementTransform("translate", { x: translation.x, y: newY });
                }}
              />
            </div>
            <canvas className="myCanvas" ref={canvasRef}></canvas>
            <div className="top-right-buttons">
              <button onClick={toggleDrawingMode}>
                {isDrawingModeRef.current ? "Stop Drawing" : "Start Drawing"}
              </button>
              <button onClick={handleUndo}>Undo</button>
              <button onClick={handleRedo}>Redo</button>
              <button onClick={handleExport}>Save SVG</button>
            </div>
          </>
        )}
      </div>
    );
  }
  
  export default App;
  