
import React, { useState, useCallback, useMemo } from 'react';
import { RefreshCw, Clipboard, AlertTriangle, Send, Heart, Droplet, Zap } from 'lucide-react';

// --- truncated system instructions kept as constants (for usage) ---
const SYSTEM_INSTRUCTION_PLAN = `...`; // omitted for brevity in shipping scaffold
const SYSTEM_INSTRUCTION_TRIAGE = `...`;
const SYSTEM_INSTRUCTION_HOME_CARE = `...`;
const SYSTEM_INSTRUCTION_DIFFERENTIAL = `...`;
const SYSTEM_INSTRUCTION_DRUG_ADVICE = `...`;

// Simple parse helpers (kept minimal)
const parsePlan = (planText) => {
  if (!planText) return [];
  const sections = planText.split(/\n\s*(?=\d+\) )/);
  return sections.filter(s => s.trim() !== '').map((section, index) => {
    const match = section.match(/^(\d+\) [^\n:]+):?\s*(.*)/s);
    if (match) {
      const [_, title, content] = match;
      return { id: index, title: title.trim(), content: content.trim() };
    }
    if (section.startsWith('**KẾ HOẠCH')) return null;
    return { id: index, title: 'Nội dung', content: section.trim() };
  }).filter(s => s !== null);
};

const parseHomeCare = (homeCareText) => {
  if (!homeCareText) return [];
  const sections = homeCareText.split(/(\*\*[^**]+\*\*)/).filter(s => s.trim());
  const result = [];
  for (let i = 0; i < sections.length; i += 2) {
    if (sections[i + 1]) {
      result.push({
        id: i / 2,
        title: sections[i].replace(/\*\*|:/g, '').trim(),
        content: sections[i+1].trim()
      });
    }
  }
  return result;
};

const fetchWithRetry = async (url, options, maxRetries = 3) => {
  let lastError = null;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorBody = await response.text().catch(()=>'');
        throw new Error(`HTTP ${response.status} ${errorBody}`);
      }
      return response;
    } catch (e) {
      lastError = e;
      await new Promise(r => setTimeout(r, Math.pow(2,i)*500));
    }
  }
  throw lastError;
};

const App = () => {
  const [reason, setReason] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('geminiApiKey') || '');
  const [plan, setPlan] = useState('');
  const [triageResult, setTriageResult] = useState(null);
  const [homeCareInstructions, setHomeCareInstructions] = useState('');
  const [differentialResult, setDifferentialResult] = useState(null);
  const [drugAdviceResult, setDrugAdviceResult] = useState(null);

  const [isLoadingPlan, setIsLoadingPlan] = useState(false);
  const [isLoadingTriage, setIsLoadingTriage] = useState(false);
  const [isLoadingHomeCare, setIsLoadingHomeCare] = useState(false);
  const [isLoadingDifferential, setIsLoadingDifferential] = useState(false);
  const [isLoadingDrugAdvice, setIsLoadingDrugAdvice] = useState(false);

  const [error, setError] = useState(null);

  const parsedPlan = useMemo(() => parsePlan(plan), [plan]);
  const parsedHomeCare = useMemo(() => parseHomeCare(homeCareInstructions), [homeCareInstructions]);

  const handleApiKeyChange = (e) => {
    const newKey = e.target.value;
    setApiKey(newKey);
    localStorage.setItem('geminiApiKey', newKey);
  };

  const handleAPICall = useCallback(async (type) => {
    if (!reason.trim()) { setError('Vui lòng nhập "Lý do đến trạm".'); return; }
    if (!apiKey.trim()) { setError('Vui lòng nhập Gemini API Key.'); return; }
    setError(null);

    let setLoadState = null;
    let setContent = null;
    let systemInstruction = '';
    let isJson = false;
    let schema = null;

    if (type === 'plan') { setLoadState = setIsLoadingPlan; setContent = setPlan; systemInstruction = SYSTEM_INSTRUCTION_PLAN; }
    else if (type === 'triage') { setLoadState = setIsLoadingTriage; setContent = setTriageResult; systemInstruction = SYSTEM_INSTRUCTION_TRIAGE; isJson = true; }
    else if (type === 'homecare') { setLoadState = setIsLoadingHomeCare; setContent = setHomeCareInstructions; systemInstruction = SYSTEM_INSTRUCTION_HOME_CARE; }
    else if (type === 'differential') { setLoadState = setIsLoadingDifferential; setContent = setDifferentialResult; systemInstruction = SYSTEM_INSTRUCTION_DIFFERENTIAL; isJson = true; }
    else if (type === 'drugAdvice') { setLoadState = setIsLoadingDrugAdvice; setContent = setDrugAdviceResult; systemInstruction = SYSTEM_INSTRUCTION_DRUG_ADVICE; isJson = true; }

    setLoadState(true);
    try {
      // This scaffold will not call a real Gemini endpoint by default.
      // For users who supply an API key for Google Generative Language, the endpoint and payload can be adjusted.
      // Here we simulate a response for offline safety and demo.
      await new Promise(r => setTimeout(r, 800));
      if (isJson) {
        const demo = { message: "Demo response - replace with real API call", type };
        if (type === 'triage') setTriageResult({ triageLevel: "Cấp 3", priority: "Khẩn cấp", summary: "Tình trạng khẩn cấp trung bình", immediateActions: ["Đo sinh hiệu", "Thiết lập đường truyền", "Cho oxy nếu SpO2 < 92%"]});
        if (type === 'differential') setDifferentialResult({ differentialDiagnosis: [{ diagnosis: "Viêm đường hô hấp", likelihood: "Rất cao", rationale: "Sốt, ho" }]});
        if (type === 'drugAdvice') setDrugAdviceResult({ firstLineDrug: { name: "Paracetamol", dosage: "500mg uống", frequency: "Mỗi 4-6 giờ nếu cần", indication: "Hạ sốt" }, criticalWarnings: ["Không dùng quá 4g/ngày","Thận trọng suy gan"]});
      } else {
        if (type === 'plan') {
          const demoPlan = `**KẾ HOẠCH SƠ CẤP CỨU NGẮN GỌN**

1) GIẢ ĐỊNH NGẮN: Người lớn 18–65 tuổi, không mang thai, không suy gan/thận nặng.
2) ĐÁNH GIÁ NHANH (ABC + sinh hiệu): A: Đường thở kiểm tra; B: Nhịp thở; C: Mạch, HA. HA, Mạch, Nhịp thở, SpO2, Thân nhiệt, Glucose mao mạch.
3) XỬ TRÍ TẠI TRẠM:
   - Đảm bảo đường thở.
   - Cho oxy nếu SpO2 < 92%.
   - Paracetamol 500mg uống nếu sốt ≥ 38.5°C.
4) THEO DÕI: Sinh hiệu mỗi 15 phút.
5) RED FLAGS — CHUYỂN TUYẾN NGAY: Rối loạn tri giác, HA < 90/60, SpO2 < 85%, chảy máu không cầm.
6) GHI CHO PHIẾU CHUYỂN: Chẩn đoán sơ bộ: Sốt cao nghi nhiễm trùng. Trạng thái: sinh hiệu kèm theo. Thuốc đã cho: Paracetamol 500mg. Thời gian chuyển: ngay. Phương tiện: xe cứu thương. Người đi kèm: người nhà.
7) CHỐNG CHỈ ĐỊNH / LƯU Ý NGẮN: Tránh dùng NSAIDs nếu có nguy cơ chảy máu.
`;
          setPlan(demoPlan);
        }
        if (type === 'homecare') {
          const demoHome = `**CÁCH SỬ DỤNG THUỐC ĐÃ CẤP**
Uống thuốc hạ sốt (Paracetamol) 500mg mỗi 4-6 giờ khi cần, không quá 4g/ngày.

**CHĂM SÓC KHÔNG DÙNG THUỐC**
Nghỉ ngơi, bù nước, lau mát.

**CHẾ ĐỘ ĂN UỐNG VÀ SINH HOẠT**
Ăn nhẹ, tránh đồ nặng, nghỉ ngơi.

**DẤU HIỆU CẦN ĐƯA TRỞ LẠI TRẠM NGAY**
Khó thở, lú lẫn, sốt kéo dài >48 giờ, nôn nhiều.
`;
          setHomeCareInstructions(demoHome);
        }
      }
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setLoadState(false);
    }
  }, [reason, apiKey]);

  const generatePlan = () => handleAPICall('plan');
  const generateTriage = () => handleAPICall('triage');
  const generateHomeCare = () => handleAPICall('homecare');
  const generateDifferential = () => handleAPICall('differential');
  const generateDrugAdvice = () => handleAPICall('drugAdvice');

  const copyToClipboard = (text, name) => {
    if (!text) return;
    const value = typeof text === 'string' ? text : JSON.stringify(text, null, 2);
    navigator.clipboard.writeText(value).then(()=> {
      alert(`Đã sao chép ${name} vào clipboard`);
    }).catch(()=>{alert('Không thể sao chép');});
  };

  const isAnyLoading = isLoadingPlan || isLoadingTriage || isLoadingHomeCare || isLoadingDifferential || isLoadingDrugAdvice;

  return (
    <div className="min-h-screen p-4 sm:p-8 bg-gray-50 font-sans">
      <script src="https://cdn.tailwindcss.com"></script>
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-sky-800 flex items-center justify-center">
            <Heart className="w-8 h-8 mr-3 text-red-500" />
            CÔNG CỤ HỖ TRỢ CHẨN ĐOÁN VÀ CẤP CỨU TRẠM Y TẾ
          </h1>
          <p className="text-gray-600 mt-2">Sử dụng trí tuệ nhân tạo để lập kế hoạch, phân loại cấp cứu và chẩn đoán.</p>
        </header>

        <div className="bg-white p-6 rounded-xl shadow mb-6 border border-sky-100">
          <label className="block text-lg font-semibold text-gray-700 mb-3 flex items-center">
            <Droplet className="w-5 h-5 mr-2 text-sky-600" />
            Lý do đến trạm (Triệu chứng / Chấn thương)
          </label>
          <textarea
            className="w-full p-4 border border-gray-300 rounded-lg focus:ring-sky-500 focus:border-sky-500 resize-y min-h-[120px]"
            placeholder='Ví dụ: Bệnh nhân bị sốt cao 39.5°C kèm đau đầu và nôn ói.'
            value={reason}
            onChange={(e)=>setReason(e.target.value)}
            disabled={isAnyLoading}
          />

          <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-300">
            <label className="block text-sm font-bold mb-1">Gemini API Key (chỉ dùng tại client)</label>
            <input
              className="w-full p-2 border rounded"
              placeholder="Nhập Gemini API Key hoặc để trống để dùng chế độ demo"
              value={apiKey}
              onChange={handleApiKeyChange}
              type="text"
            />
            <p className="text-xs text-gray-600 mt-2">Không lưu key lên GitHub. Chỉ dùng để thử nghiệm client-side.</p>
          </div>

          {error && <div className="mt-3 text-red-700 font-medium">{error}</div>}

          <div className="mt-4 flex gap-3 flex-wrap">
            <button onClick={generatePlan} className="px-4 py-2 bg-sky-600 text-white rounded flex items-center" disabled={isAnyLoading}>
              <Clipboard className="mr-2" /> Tạo Kế hoạch
            </button>
            <button onClick={generateTriage} className="px-4 py-2 bg-orange-500 text-white rounded flex items-center" disabled={isAnyLoading}>
              <AlertTriangle className="mr-2" /> Triage
            </button>
            <button onClick={generateHomeCare} className="px-4 py-2 bg-green-600 text-white rounded flex items-center" disabled={isAnyLoading}>
              <Zap className="mr-2" /> Hướng dẫn tại nhà
            </button>
            <button onClick={generateDifferential} className="px-4 py-2 bg-yellow-500 text-white rounded" disabled={isAnyLoading}>Chẩn đoán phân biệt</button>
            <button onClick={generateDrugAdvice} className="px-4 py-2 bg-indigo-600 text-white rounded" disabled={isAnyLoading}>Gợi ý thuốc</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-5 rounded shadow">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">KẾ HOẠCH SƠ CẤP CỨU</h3>
              <div className="flex gap-2">
                <button onClick={()=>copyToClipboard(plan, 'Kế hoạch Sơ cấp cứu')} className="text-sm px-2 py-1 border rounded">Sao chép</button>
              </div>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-gray-800">{plan || 'Chưa có kế hoạch. Nhấn "Tạo Kế hoạch".'}</pre>
          </div>

          <div className="bg-white p-5 rounded shadow">
            <h3 className="font-semibold mb-3">HƯỚNG DẪN CHĂM SÓC TẠI NHÀ</h3>
            <div className="mb-2">
              <button onClick={()=>copyToClipboard(homeCareInstructions, 'Hướng dẫn Chăm sóc')} className="text-sm px-2 py-1 border rounded">Sao chép</button>
            </div>
            <pre className="whitespace-pre-wrap text-sm text-gray-800">{homeCareInstructions || 'Chưa có hướng dẫn. Nhấn "Hướng dẫn tại nhà".'}</pre>
          </div>

          <div className="bg-white p-5 rounded shadow">
            <h3 className="font-semibold mb-3">TRIAGE (JSON)</h3>
            <pre className="whitespace-pre-wrap text-sm text-gray-800">{triageResult ? JSON.stringify(triageResult, null, 2) : 'Chưa có kết quả Triage.'}</pre>
          </div>

          <div className="bg-white p-5 rounded shadow">
            <h3 className="font-semibold mb-3">CHẨN ĐOÁN PHÂN BIỆT (JSON)</h3>
            <pre className="whitespace-pre-wrap text-sm text-gray-800">{differentialResult ? JSON.stringify(differentialResult, null, 2) : 'Chưa có chẩn đoán phân biệt.'}</pre>
          </div>

          <div className="bg-white p-5 rounded shadow md:col-span-2">
            <h3 className="font-semibold mb-3">GỢI Ý THUỐC (JSON)</h3>
            <pre className="whitespace-pre-wrap text-sm text-gray-800">{drugAdviceResult ? JSON.stringify(drugAdviceResult, null, 2) : 'Chưa có gợi ý thuốc.'}</pre>
          </div>
        </div>

        <footer className="mt-8 text-center text-gray-500 text-sm">Health Aid · Demo build</footer>
      </div>
    </div>
  );
};

export default App;
