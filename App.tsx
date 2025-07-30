
import React, { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { GoogleGenAI, Type } from "@google/genai";

// --- TYPES & CONSTANTS ---

interface Job {
  title: string;
  description: string;
}

export interface CanvasRef {
  clear: () => void;
  toBase64: () => string;
}

const INITIAL_MESSAGE: Job = {
    title: "디지털 직업 상자",
    description: "아래 '생성하기' 버튼을 눌러 AI가 만들어주는 미래 직업을 확인하고, 직접 그림으로 표현해보세요!"
};


// --- HELPER COMPONENTS ---

interface ScreenProps {
    job: Job | null;
    isLoading: boolean;
    error: string | null;
}

const Screen: React.FC<ScreenProps> = ({ job, isLoading, error }) => {
    const [loadingText, setLoadingText] = useState('GENERATING');

    useEffect(() => {
        let intervalId: number | null = null;
        if (isLoading) {
            setLoadingText('GENERATING');
            intervalId = window.setInterval(() => {
                setLoadingText(prev => {
                    if (prev.length >= 12) return 'GENERATING';
                    return prev + '.';
                });
            }, 300);
        }
        
        return () => {
            if (intervalId) {
                clearInterval(intervalId);
            }
        };
    }, [isLoading]);
    
    const displayData = !isLoading && !job && !error ? INITIAL_MESSAGE : job;

    return (
        <div className="bg-[#9bbc0f] text-[#0f380f] font-vt323 h-64 w-full rounded-lg p-4 border-4 border-gray-400 shadow-inner flex flex-col justify-center items-center overflow-y-auto">
            {isLoading ? (
                <div className="text-4xl animate-pulse">{loadingText}</div>
            ) : error ? (
                 <div className="text-center transition-opacity duration-500">
                    <h2 className="text-3xl mb-4 break-words text-red-900">오류 발생</h2>
                    <p className="text-xl leading-tight break-words">{error}</p>
                 </div>
            ) : (
                displayData && (
                    <div className="text-center transition-opacity duration-500">
                        <h2 className="text-4xl mb-4 break-words">{displayData.title}</h2>
                        <p className="text-xl leading-tight break-words">{displayData.description}</p>
                    </div>
                )
            )}
        </div>
    );
};

const DrawingCanvas = forwardRef<CanvasRef, { height: number; }>(({ height }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const contextRef = useRef<CanvasRenderingContext2D | null>(null);
    const isDrawing = useRef(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext('2d');
        if (!context) return;
    
        const handleResize = () => {
            const { width } = canvas.getBoundingClientRect();
            const dpi = window.devicePixelRatio || 1;
    
            canvas.width = Math.floor(width * dpi);
            canvas.height = Math.floor(height * dpi);
            canvas.style.height = `${height}px`;
    
            context.setTransform(dpi, 0, 0, dpi, 0, 0);
            context.lineCap = 'round';
            context.strokeStyle = '#0f380f';
            context.lineWidth = 5;
            contextRef.current = context;
        };
    
        const resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(canvas);
    
        return () => resizeObserver.disconnect();
    }, [height]);
    

    useImperativeHandle(ref, () => ({
        clear: () => {
            const canvas = canvasRef.current;
            const context = contextRef.current;
            if (canvas && context) {
                context.save();
                context.setTransform(1, 0, 0, 1, 0, 0);
                context.clearRect(0, 0, canvas.width, canvas.height);
                context.restore();
            }
        },
        toBase64: () => {
            const canvas = canvasRef.current;
            if (!canvas) return "";
            return canvas.toDataURL('image/png').split(',')[1];
        }
    }));
    
    const getCoords = (event: React.MouseEvent | React.TouchEvent): { x: number, y: number } | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        
        let clientX, clientY;
        if ('touches' in event.nativeEvent) {
             if (event.nativeEvent.touches.length === 0) return null;
             clientX = event.nativeEvent.touches[0].clientX;
             clientY = event.nativeEvent.touches[0].clientY;
        } else {
            clientX = (event as React.MouseEvent).clientX;
            clientY = (event as React.MouseEvent).clientY;
        }
        return { x: clientX - rect.left, y: clientY - rect.top };
    }


    const startDrawing = (event: React.MouseEvent | React.TouchEvent) => {
        const coords = getCoords(event);
        const context = contextRef.current;
        if (!context || !coords) return;
        context.beginPath();
        context.moveTo(coords.x, coords.y);
        isDrawing.current = true;
    };

    const stopDrawing = () => {
        const context = contextRef.current;
        if (!context) return;
        context.closePath();
        isDrawing.current = false;
    };

    const draw = (event: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawing.current) return;
        const coords = getCoords(event);
        const context = contextRef.current;
        if (!context || !coords) return;
        context.lineTo(coords.x, coords.y);
        context.stroke();
    };

    return (
        <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onMouseMove={draw}
            onTouchStart={startDrawing}
            onTouchEnd={stopDrawing}
            onTouchMove={draw}
            className="bg-[#9bbc0f] text-[#0f380f] w-full rounded-lg border-4 border-gray-400 shadow-inner cursor-crosshair"
            style={{ touchAction: 'none' }}
        />
    );
});


const DPad: React.FC = () => (
    <div className="grid grid-cols-3 grid-rows-3 w-24 h-24">
        <div className="col-start-2 row-start-1 bg-gray-800 rounded-sm"></div>
        <div className="col-start-1 row-start-2 bg-gray-800 rounded-sm"></div>
        <div className="col-start-2 row-start-2 bg-gray-800 rounded-sm"></div>
        <div className="col-start-3 row-start-2 bg-gray-800 rounded-sm"></div>
        <div className="col-start-2 row-start-3 bg-gray-800 rounded-sm"></div>
    </div>
);

interface ActionButtonsProps {
    onGenerate: () => void;
    isLoading: boolean;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({ onGenerate, isLoading }) => (
    <div className="flex flex-col items-center space-y-4">
        <button
            onClick={onGenerate}
            disabled={isLoading}
            className="w-24 h-24 bg-red-600 rounded-full text-white text-xl shadow-md border-4 border-red-800 flex justify-center items-center transform transition hover:bg-red-500 active:translate-y-1 disabled:bg-gray-500 disabled:cursor-not-allowed disabled:shadow-none disabled:active:translate-y-0"
        >
            {isLoading ? "..." : "생성하기"}
        </button>
        <div className="flex space-x-6 text-sm text-gray-700">
            <span>SELECT</span>
            <span>START</span>
        </div>
    </div>
);


// --- MAIN APP COMPONENT ---

const App: React.FC = () => {
    const [currentJob, setCurrentJob] = useState<Job | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [compliment, setCompliment] = useState<string | null>(null);
    const canvasRef = useRef<CanvasRef>(null);
    
    const handleGenerateJob = useCallback(async () => {
        if (isLoading || isAnalyzing) return;
        
        setIsLoading(true);
        setError(null);
        setCurrentJob(null);
        setCompliment(null);
        canvasRef.current?.clear();

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: "상상력이 풍부하고, 어린이도 이해하기 쉬운 흥미로운 미래 직업 이름과 간단한 설명을 한 가지 생성해줘.",
                config: {
                    temperature: 1,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING, description: "생성된 직업의 이름" },
                            description: { type: Type.STRING, description: "생성된 직업에 대한 2-3문장의 간결한 설명" },
                        },
                        required: ["title", "description"]
                    },
                },
            });
            const newJob = JSON.parse(response.text);
            setCurrentJob(newJob);
        } catch(e) {
            console.error(e);
            setError("AI 직업 생성에 실패했습니다. 잠시 후 다시 시도해주세요.");
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, isAnalyzing]);

    const handleCheckDrawing = useCallback(async () => {
        if (!currentJob || !canvasRef.current || isAnalyzing || isLoading) return;

        setIsAnalyzing(true);
        setError(null);
        setCompliment(null);

        try {
            const base64Image = canvasRef.current.toBase64();
            if (!base64Image) {
                setCompliment("그림을 먼저 그려주세요!");
                setIsAnalyzing(false);
                return;
            }

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const imagePart = { inlineData: { mimeType: 'image/png', data: base64Image } };
            const textPart = { text: `이 그림은 "${currentJob.title}"라는 직업을 묘사한 것입니다. 직업 설명은 다음과 같습니다: "${currentJob.description}". 그림이 이 직업을 잘 표현했다면, 어린아이에게 말하듯 친절하고 짧은 칭찬 한 문장을 한국어로 작성해주세요. 그림이 설명과 거의 관련이 없다면 "다시 그려볼까요?"라고만 답해주세요.` };

            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: { parts: [imagePart, textPart] },
            });
            
            setCompliment(response.text);
        } catch(e) {
            console.error(e);
            setError("그림 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
        } finally {
            setIsAnalyzing(false);
        }
    }, [currentJob, isAnalyzing, isLoading]);


    return (
        <div className="flex flex-col justify-center items-center min-h-screen p-4">
            <main className="w-full max-w-md bg-white rounded-3xl p-6 border-8 border-gray-300 shadow-2xl space-y-4">
                <div className="flex justify-between items-center px-2">
                    <h1 className="text-xl font-bold text-gray-700">Digital Job Box</h1>
                    <div className="flex space-x-1">
                        <div className="w-3 h-3 bg-red-500 rounded-full border border-gray-600"></div>
                        <div className="w-3 h-3 bg-yellow-500 rounded-full border border-gray-600"></div>
                        <div className="w-3 h-3 bg-green-500 rounded-full border border-gray-600"></div>
                    </div>
                </div>

                <Screen job={currentJob} isLoading={isLoading} error={error && !compliment ? error : null} />
                
                {currentJob && !isLoading && (
                    <div className="space-y-3 transition-opacity duration-500">
                        <p className="text-center font-vt323 text-lg text-gray-600">이 직업을 그림으로 표현해보세요!</p>
                        <DrawingCanvas ref={canvasRef} height={120} />
                        <button
                            onClick={handleCheckDrawing}
                            disabled={isAnalyzing || isLoading}
                            className="w-full py-2 bg-[#0f380f] text-white font-jua rounded-lg shadow-md hover:bg-green-800 disabled:bg-gray-500 disabled:cursor-wait"
                        >
                            {isAnalyzing ? '그림 분석 중...' : '이 직업이 맞는지 확인!'}
                        </button>
                        {compliment && (
                             <div className="p-3 bg-[#9bbc0f] border-2 border-[#0f380f] text-[#0f380f] rounded-lg text-center font-vt323 text-2xl animate-pulse">
                                {compliment}
                             </div>
                        )}
                         {error && compliment && (
                             <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-center font-jua text-base">
                                {error}
                             </div>
                        )}
                    </div>
                )}


                <div className="flex justify-between items-center pt-4 px-4">
                    <DPad />
                    <ActionButtons onGenerate={handleGenerateJob} isLoading={isLoading || isAnalyzing} />
                </div>
            </main>
            <footer className="text-center text-gray-600 text-sm mt-8">
                © 2025 오승혁 저작권
            </footer>
        </div>
    );
};

export default App;
