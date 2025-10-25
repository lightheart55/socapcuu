import React, { useState, useCallback } from 'react';
import { RefreshCw, Clipboard, AlertTriangle, Send, Heart, Droplet, Zap, Home } from 'lucide-react';

const SYSTEM_INSTRUCTION_PLAN = `
Bạn là Bác sĩ/Nhân viên y tế tại Trạm Y tế Xã/Phường. Nhiệm vụ của bạn là lập một KẾ HOẠCH SƠ CẤP CỨU NGẮN GỌN và CHÍNH XÁC dựa trên 'lý do đến trạm' của bệnh nhân.

Quy tắc Bắt buộc:
1. Văn phong: PHẢI sử dụng văn phong hành chính y tế, câu ngắn, mục rõ ràng, và thuật ngữ y tế chính xác (tiếng Việt).
2. Giả định mặc định: Nếu thiếu thông tin quan trọng (tuổi, tiền sử), bạn PHẢI GIẢ ĐỊNH MẶC ĐỊNH: 'Người lớn 18–65 tuổi, không mang thai, không suy gan/thận nặng.' và ghi rõ giả định này ở Mục 1.
3. Cấu trúc 7 Mục: PHẢI TUÂN THỦ TUYỆT ĐỐI cấu trúc 7 mục sau, bắt đầu bằng tiêu đề in đậm:

**KẾ HOẠCH SƠ CẤP CỨU NGẮN GỌN**

1) GIẢ ĐỊNH NGẮN (1 câu): Ghi các giả định bắt buộc nếu không có dữ liệu.
2) ĐÁNH GIÁ NHANH (ABC + sinh hiệu): Liệt kê các chỉ số phải đo/kiểm tra ngay: Đường thở (A), Thở (B), Tuần hoàn (C); HA, Mạch, Nhịp thở, SpO₂, Thân nhiệt, Đường máu mao mạch (Glucose).
3) XỬ TRÍ TẠI TRẠM (bước theo thứ tự, gạch đầu dòng):
   - Các can thiệp cấp cứu cần thực hiện ngay.
   - Nêu thuốc gợi ý (tên gốc) và đường dùng ngắn gọn (ví dụ: Paracetamol 500mg uống).
4) THEO DÕI (gồm chỉ số và tần suất): Những gì phải quan sát và khoảng thời gian theo dõi (ví dụ: Sinh hiệu 15 phút/lần).
5) RED FLAGS — CHUYỂN TUYẾN NGAY (liệt kê 4–6 dấu hiệu): Nếu có, hướng dẫn chuyển tuyến cấp cứu (Ví dụ: Rối loạn tri giác, HA thấp < 90/60 mmHg).
6) GHI CHO PHIẾU CHUYỂN (1–2 câu): Chẩn đoán sơ bộ; trạng thái khi chuyển (sinh hiệu); thuốc/đầu can thiệp đã cho; thời gian đề xuất chuyển; phương tiện đề xuất; người đi kèm.
7) CHỐNG CHỈ ĐỊNH / LƯU Ý NGẮN: Thuốc hoặc biện pháp cần tránh trong hoàn cảnh này.

Không hỏi thêm thông tin. Nếu cần thông tin quan trọng để thay đổi xử trí, chỉ liệt kê 2–3 thông tin cần bổ sung trong phần XỬ TRÍ TẠI TRẠM dưới dạng 'Cần bổ sung thông tin:'.
`;

const SYSTEM_INSTRUCTION_TRIAGE = `
Bạn là chuyên gia y tế khẩn cấp. Dựa trên lý do đến trạm, hãy đưa ra đánh giá nhanh về mức độ ưu tiên cấp cứu (Triage) và 3 hành động kiểm tra/can thiệp ưu tiên nhất.
Định dạng đầu ra PHẢI là JSON theo schema được cung cấp. Không thêm bất kỳ văn bản giải thích nào khác. Sử dụng thang phân loại Triage 5 cấp độ (ví dụ: Cấp 1 - Hồi sức, Cấp 5 - Không khẩn cấp).
`;

const TRIAGE_SCHEMA = {
    type: "OBJECT",
    properties: {
        triageLevel: { type: "STRING" },
        priority: { type: "STRING" },
        summary: { type: "STRING" },
        immediateActions: { type: "ARRAY", items: { type: "STRING" } }
    }
};

const SYSTEM_INSTRUCTION_HOME_CARE = `
Bạn là Nhân viên y tế/Bác sĩ tại Trạm Y tế Xã. Nhiệm vụ của bạn là soạn thảo một bản Hướng dẫn Chăm sóc Tại nhà ngắn gọn, rõ ràng, và dễ hiểu dành cho bệnh nhân hoặc người nhà.
Cấu trúc PHẢI bao gồm 4 mục chính (ghi bằng tiêu đề in đậm):
1.  **CÁCH SỬ DỤNG THUỐC ĐÃ CẤP** (Tên gốc, liều dùng, tần suất).
2.  **CHĂM SÓC KHÔNG DÙNG THUỐC** (Ví dụ: nghỉ ngơi, chườm lạnh, bù nước).
3.  **CHẾ ĐỘ ĂN UỐNG VÀ SINH HOẠT**.
4.  **DẤU HIỆU CẦN ĐƯA TRỞ LẠI TRẠM NGAY** (Liệt kê 3-4 dấu hiệu nguy hiểm).
Văn phong: Gần gũi, động viên, sử dụng ngôn ngữ phổ thông, không dùng thuật ngữ y tế chuyên sâu.
`;

const fetchWithRetry = async (url, options, maxRetries = 5) => {
    let lastError = null;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response;
        } catch (error) {
            lastError = error;
            const delay = Math.pow(2, i) * 1000;
            if (i < maxRetries - 1) await new Promise(r => setTimeout(r, delay));
        }
    }
    throw new Error(`API failed after ${maxRetries} retries. Last error: ${lastError?.message}`);
};

const App = () => {
    const [reason, setReason] = useState('');
    const [plan, setPlan] = useState('');
    const [triageResult, setTriageResult] = useState(null);
    const [homeCareInstructions, setHomeCareInstructions] = useState('');
    const [isLoadingPlan, setIsLoadingPlan] = useState(false);
    const [isLoadingTriage, setIsLoadingTriage] = useState(false);
    const [isLoadingHomeCare, setIsLoadingHomeCare] = useState(false);
    const [error, setError] = useState(null);

    // API key handled in UI and localStorage to avoid editing source code
    const [apiKeyInput, setApiKeyInput] = useState(localStorage.getItem('GC_API_KEY') || '');
    const saveApiKey = () => {
        localStorage.setItem('GC_API_KEY', apiKeyInput.trim());
        alert('API key đã lưu trong trình duyệt.');
    };
    const getApiKey = () => localStorage.getItem('GC_API_KEY') || '';

    const handleAPICall = useCallback(async (type) => {
        if (!reason.trim()) { setError('Vui lòng nhập \"Lý do đến trạm\"'); return; }
        setError(null);
        let setLoadState, setContent, systemInstruction, isJson = false;
        if (type === 'plan') { setLoadState = setIsLoadingPlan; setContent = setPlan; systemInstruction = SYSTEM_INSTRUCTION_PLAN; }
        else if (type === 'triage') { setLoadState = setIsLoadingTriage; setContent = setTriageResult; systemInstruction = SYSTEM_INSTRUCTION_TRIAGE; isJson = true; }
        else if (type === 'homecare') { setLoadState = setIsLoadingHomeCare; setContent = setHomeCareInstructions; systemInstruction = SYSTEM_INSTRUCTION_HOME_CARE; }
        else return;

        const apiKey = getApiKey();
        if (!apiKey) { setError('API key chưa được nhập. Vui lòng nhập API key và bấm Lưu.'); return; }

        setLoadState(true);
        setContent(null);

        const modelName = "gemini-2.5-flash-preview-09-2025";
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const userQuery = `Lý do đến trạm: \"${reason.trim()}\"`;

        let payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] }
        };
        if (isJson) {
            payload.generationConfig = { responseMimeType: "application/json", responseSchema: TRIAGE_SCHEMA };
        }

        try {
            const response = await fetchWithRetry(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const result = await response.json();
            const candidate = result.candidates?.[0];
            if (isJson) {
                const jsonText = candidate?.content?.parts?.[0]?.text;
                if (jsonText) {
                    try { const parsedJson = JSON.parse(jsonText); setTriageResult(parsedJson); }
                    catch (e) { console.error('JSON Parse Error:', e); setError('Lỗi phân tích kết quả Triage.'); }
                } else setError('Không thể tạo kết quả Triage.');
            } else {
                const generatedText = candidate?.content?.parts?.[0]?.text || 'Không thể tạo nội dung.';
                const cleanedText = generatedText.replace(/^```\\w*\\n|```$/g, '').trim();
                setContent(cleanedText);
            }
        } catch (err) { console.error('API Error:', err); setError(`Lỗi API: ${err.message}`); }
        finally { setLoadState(false); }
    }, [reason]);

    const generatePlan = () => handleAPICall('plan');
    const generateTriage = () => handleAPICall('triage');
    const generateHomeCare = () => handleAPICall('homecare');

    const copyToClipboard = (text, name) => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => alert(`Đã sao chép ${name} vào clipboard.`));
    };

    const getTriageColor = (level) => {
        switch (level) {
            case 'Cấp 1': return 'background:#dc2626;color:white;padding:4px;border-radius:999px;font-weight:700;';
            case 'Cấp 2': return 'background:#f97316;color:white;padding:4px;border-radius:999px;font-weight:700;';
            case 'Cấp 3': return 'background:#f59e0b;color:#111;padding:4px;border-radius:999px;font-weight:700;';
            case 'Cấp 4': return 'background:#16a34a;color:white;padding:4px;border-radius:999px;font-weight:700;';
            case 'Cấp 5': return 'background:#3b82f6;color:white;padding:4px;border-radius:999px;font-weight:700;';
            default: return 'background:#9ca3af;color:white;padding:4px;border-radius:999px;font-weight:700;';
        }
    };

    const isAnyLoading = isLoadingPlan || isLoadingTriage || isLoadingHomeCare;

    return (
        <div style={{minHeight:'100vh',padding:20,background:'#f8fafc',fontFamily:'Inter, system-ui, Arial'}}>
            <div style={{maxWidth:900,margin:'0 auto'}}>
                <header style={{textAlign:'center',marginBottom:24}}>
                    <h1 style={{fontSize:28,color:'#075985',display:'flex',alignItems:'center',justifyContent:'center',gap:10}}><Heart />KẾ HOẠCH CẤP CỨU TRẠM Y TẾ</h1>
                    <p style={{color:'#475569'}}>Chạy cục bộ. Nhập API key một lần. Dùng Chrome mở địa chỉ http://localhost:5173</p>
                </header>

                <div style={{background:'#fff',padding:16,borderRadius:12,boxShadow:'0 10px 15px rgba(0,0,0,0.05)',border:'1px solid #e0f2fe',marginBottom:16}}>
                    <label style={{display:'block',fontWeight:700,marginBottom:8, color:'#334155'}}>API Key (Google Generative Language)</label>
                    <div style={{display:'flex',gap:8}}>
                        <input value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder="Nhập API key vào đây" style={{flex:1,padding:10,borderRadius:8,border:'1px solid #cbd5e1'}} />
                        <button onClick={saveApiKey} style={{padding:'10px 12px',background:'#06b6d4',color:'white',borderRadius:8}}>Lưu</button>
                    </div>
                    <p style={{marginTop:8,color:'#64748b',fontSize:13}}>API key được lưu trong trình duyệt. Không cần sửa code.</p>
                </div>

                <div style={{background:'#fff',padding:16,borderRadius:12,boxShadow:'0 10px 15px rgba(0,0,0,0.05)',border:'1px solid #e0f2fe',marginBottom:16}}>
                    <label style={{display:'block',fontWeight:700,marginBottom:8,color:'#334155'}}>Lý do đến trạm</label>
                    <textarea value={reason} onChange={(e)=>setReason(e.target.value)} rows={4} placeholder='Ví dụ: Bệnh nhân sốt cao 39.5°C kèm đau đầu và nôn ói.' style={{width:'100%',padding:12,borderRadius:8,border:'1px solid #cbd5e1'}} />
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginTop:12}}>
                        <button onClick={generateTriage} disabled={isAnyLoading} style={{padding:10,background:'#4f46e5',color:'white',borderRadius:8}}>✨ Triage Nhanh</button>
                        <button onClick={generateHomeCare} disabled={isAnyLoading} style={{padding:10,background:'#0ea5a4',color:'white',borderRadius:8}}>✨ Hướng dẫn Tại nhà</button>
                        <button onClick={generatePlan} disabled={isAnyLoading} style={{padding:10,background:'#0ea5e9',color:'white',borderRadius:8}}>Lập KẾ HOẠCH SƠ CẤP CỨU</button>
                    </div>
                    {error && <div style={{marginTop:12,padding:10,background:'#fee2e2',color:'#991b1b',borderRadius:8}}>{error}</div>}
                </div>

                <div style={{background:'#fff',padding:16,borderRadius:12,boxShadow:'0 10px 15px rgba(0,0,0,0.05)',border:'1px solid #e6e6e6',marginBottom:16}}>
                    <h2 style={{margin:0,fontSize:18,color:'#0f172a',display:'flex',alignItems:'center',gap:8}}><Zap />✨ ĐÁNH GIÁ TRIAGE NHANH</h2>
                    {triageResult ? (
                        <div style={{marginTop:12,padding:12,background:'#eef2ff',borderRadius:8,border:'1px solid #c7d2fe'}}>
                            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',borderBottom:'1px solid #c7d2fe',paddingBottom:8}}>
                                <div style={{fontWeight:700,color:'#1e293b'}}>{triageResult.summary}</div>
                                <div style={{...{fontSize:12},...{}}}>
                                    <span style={{display:'inline-block',padding:'6px 10px',borderRadius:999,background:'#6366f1',color:'white',fontWeight:700}}>{triageResult.triageLevel}: {triageResult.priority}</span>
                                </div>
                            </div>
                            <h3 style={{marginTop:10,fontWeight:700,color:'#334155'}}>3 Hành động Ưu tiên:</h3>
                            <ul style={{paddingLeft:18,color:'#475569'}}>{triageResult.immediateActions.map((a,i)=>(<li key={i}>{a}</li>))}</ul>
                            <div style={{textAlign:'right'}}>
                                <button onClick={()=>copyToClipboard(JSON.stringify(triageResult,null,2),'Kết quả Triage')} style={{padding:6,background:'#e0e7ff',borderRadius:8}}>Sao chép (JSON)</button>
                            </div>
                        </div>
                    ) : <div style={{marginTop:12,color:'#64748b',fontStyle:'italic'}}>Nhấn nút "✨ Triage Nhanh" để nhận đánh giá ưu tiên sơ bộ.</div>}
                </div>

                <div style={{background:'#fff',padding:16,borderRadius:12,boxShadow:'0 10px 15px rgba(0,0,0,0.05)',border:'1px solid #e6e6e6',marginBottom:16}}>
                    <h2 style={{margin:0,fontSize:18,color:'#0f172a',display:'flex',alignItems:'center',gap:8}}><Home />✨ HƯỚNG DẪN CHĂM SÓC TẠI NHÀ</h2>
                    {homeCareInstructions ? (
                        <div style={{marginTop:12,padding:12,background:'#ecfeff',borderRadius:8,border:'1px solid #bbf7d0'}}>
                            <pre style={{whiteSpace:'pre-wrap'}}>{homeCareInstructions}</pre>
                            <div style={{textAlign:'right'}}><button onClick={()=>copyToClipboard(homeCareInstructions,'Hướng dẫn')} style={{padding:6,borderRadius:8,background:'#d1fae5'}}>Sao chép</button></div>
                        </div>
                    ) : <div style={{marginTop:12,color:'#64748b',fontStyle:'italic'}}>Nhấn nút "✨ Hướng dẫn Tại nhà" để tạo bản hướng dẫn.</div>}
                </div>

                <div style={{background:'#fff',padding:16,borderRadius:12,boxShadow:'0 10px 15px rgba(0,0,0,0.05)',border:'1px solid #e6e6e6'}}>
                    <h2 style={{margin:0,fontSize:18,color:'#0f172a',display:'flex',alignItems:'center',gap:8}}><Clipboard />KẾT QUẢ: Kế hoạch Sơ cấp cứu (7 Mục)</h2>
                    {plan ? (<div style={{marginTop:12,padding:12,background:'#f8fafc',borderRadius:8}}><pre style={{whiteSpace:'pre-wrap'}}>{plan}</pre><div style={{textAlign:'right'}}><button onClick={()=>copyToClipboard(plan,'Kế hoạch')} style={{padding:6,borderRadius:8,background:'#e2e8f0'}}>Sao chép</button></div></div>) : <div style={{marginTop:12,color:'#64748b',fontStyle:'italic'}}>Nhấn nút 'Lập KẾ HOẠCH SƠ CẤP CỨU' để tạo kế hoạch.</div>}
                </div>
            </div>
        </div>
    );
};

export default App;
