'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';

// Helper function to convert relative signature URLs to absolute URLs
const getSignatureUrl = (signature) => {
    if (!signature) return '';
    
    // If it's already a full URL (http/https) or base64, return as is
    if (signature.startsWith('http://') || signature.startsWith('https://') || signature.startsWith('data:')) {
        return signature;
    }
    
    // If it's a relative path starting with /uploads, convert to absolute URL
    if (signature.startsWith('/uploads') || signature.startsWith('/')) {
        // Get backend base URL from environment variable
        const backendBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL1 || 'http://localhost:3000';
        // Remove /api/operations/sts-checklist from backend URL if present to get base URL
        const baseUrl = backendBaseUrl.replace(/\/api\/operations\/sts-checklist\/?$/, '');
        // Ensure base URL doesn't end with /
        const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
        return `${cleanBaseUrl}${signature}`;
    }
    
    return signature;
};

const QUESTIONS = [
  { id: 1, text: 'Kindly confirm if your vessel has STS Transfer Plan duly approved by flag state and what are the \'STS Environmental Operating Limits\' with respect to approaching, mooring, anchoring, berthing, unmooring, cargo operation in terms of wind speed, sea state, swell and visibility.' },
  { id: 2, text: 'For Annex 1 cargo, does your vessel have an STS Plan which complies with resolution MEPC 186(59), Chapter 8 of MARPOL 73/78?' },
  { id: 3, text: 'Does the vessel maintain a Mooring System Management Plan (MSMP) that includes a Line Management Plan (LMP) If yes, please provide a copy of review.' },
  { id: 4, text: 'Does the operator permit your vessel to undertake the berthing in the hours of darkness and confirm if the same is allowed by vessel\'s charterers as well' },
  { id: 5, text: 'Is the vessel in compliance with the latest edition of the OCIMF "Ship-to-ship Transfer Guide for Petroleum, Chemicals and Liquefied Gases First Edition 2013" and ISGOTT.' },
  { id: 6, text: 'Kindly confirm the speed of the vessel at D.S. Ahead in the maneuvering condition and can vessel engine maintain D.S. Ahead for a minimum of 2 hours' },
  { id: 7, text: 'Can the vessels maneuver as per the underway berthing (Sec 6.2.2) and underway transfer procedure (Sec 6.2.4) as laid down by the Ship-to-Ship Transfer guide for Petroleum, Chemicals and Liquefied Gases' },
  { id: 8, text: 'Confirm if your vessel is clear of any overhanging projections, including extended bridge wing.' },
  { id: 9, text: 'Please confirm there are no operational deficiencies onboard the vessel including vessel\'s bridge, bridge wing, rudder indicator, ER Rev Counters, compass repeaters, main engine, rudder and steering motors.' },
  { id: 10, text: 'What is the current Gyro error?' },
  { id: 11, text: 'Confirm your radar usage will be in line with \'Ship to Ship Transfer Guide for Petroleum, Chemicals and Liquefied Gases\' Section 3.10.6? If \'No\' why?' },
  { id: 12, text: 'What is the expected displacement of the vessel on arrival and departure from STS Location' },
  { id: 13, text: 'What is the anticipated arrival and departure draft at the STS Location' },
  { id: 14, text: 'What is the anticipated arrival and departure free board at the STS Location' },
  { id: 15, text: 'What is the maximum and minimum free board during the STS Transfer' },
  { id: 16, text: 'Please mention:', subParts: ['a. What is the parallel body on arrival and upon departure', 'b. Parallel distance ahead of center of manifold on arrival and departure', 'c. Parallel distance astern of center of manifold on arrival and departure'] },
  { id: 17, text: 'Will the shearing forces and bending moments on the vessel remain within seagoing limits throughout the STS transfer' },
  { id: 18, text: 'Kindly send us a general arrangement plan or deck mooring diagram.' },
  { id: 19, text: 'Please confirm if the location and number of enclosed fairleads and mooring bitts fitted onboard comply with latest \'OCIMF Mooring Equipment Guidelines\'.' },
  { id: 20, text: 'Can the vessel be able to send 4 head, 4 stern lines and 2 spring lines each end, all on winch drum and through closed fairleads.' },
  { id: 21, text: 'Please share the break holding capacity (BHC) & last test date of each mooring winches to be used for this mooring operation.' },
  { id: 22, text: 'Does your vessel have at each mooring location, mooring lines of suitable strength to aid passing of 2 mooring wires.' },
  { id: 23, text: 'Kindly confirm if all the personnel are well acquainted of section on snap-back in the \'Effective Mooring\' guide section 4.7, \'MEG3\' section 6' },
  { id: 24, text: 'Are long handled fire axes or suitable cutting equipment placed at each mooring station' },
  { id: 25, text: 'Please advise if vessel has mooring rope tails if yes, kindly advise their conditions and number of spare tails available.' },
  { id: 26, text: 'Confirm if all mooring lines and mooring tails are in good working condition, appropriate for purpose and less than 10 years old' },
  { id: 27, text: 'Please confirm below regarding vessels mooring lines.', dateFields: ['certificateDate', 'putInUseDate', 'lastInspectionDate', 'endToEndChangeDate'] },
  { id: 28, text: 'Please confirm below regarding vessel\'s mooring tails.', dateFields: ['certificateDate', 'putInUseDate', 'lastInspectionDate'] },
  { id: 29, text: 'To avoid damage to the chocks, kindly confirm if the vessel has chafe protection cover for mooring ropes and grease for wires.' },
  { id: 30, text: 'Does the vessel\'s manifold arrangement and lifting gears comply with OCIMF Or SIGTTO recommendations for the ship type / size' },
  { id: 31, text: 'Has Cargo / COW / IG Line / COP Emergency Trips / IG Alarms and trips been tested, please specify the date.' },
  { id: 32, text: 'Manifold connections and Rates', isComplex: true },
  { id: 33, text: 'For LPG Carrier Only', isComplex: true },
  { id: 34, text: 'Please confirm if the vessel has hang-off ropes available for supporting hoses (i.e. 2 pieces approx. 30mm dia. x 15m long)' },
  { id: 35, text: 'Kindly confirm if IG System is fully operational and all cargo tanks are inerted <8% O2.' },
  { id: 36, text: 'Can your vessel conduct vapor balancing' },
  { id: 37, text: 'Please mention the arrangement of vapor manifold connection.' },
  { id: 38, text: 'is the vessel able to present 2 manifold hose connections of 6"/8"/10" vapor return hoses with correct flange bodies' },
  { id: 39, text: 'Please advise the size of your manifold hose connections for vapor hoses. Please advise if you require Oceane Fenders to provide suitable reducers for vapor hoses' },
  { id: 40, text: 'Kindly advise', isComplex: true, cargoFields: true },
  { id: 41, text: 'What is the SWL and outreach of the lifting equipment to be utilized' },
  { id: 42, text: 'Personal Transfer Basket (PTB)', isComplex: true, ptbFields: true },
  { id: 43, text: 'Personnel Transfer Basket (if permitted) – have you completed our PTB checklist OPS-OFD-028?' },
  { id: 44, text: 'Please confirm if English is common spoken language for all communication.' },
  { id: 45, text: 'Is there sufficient accommodation available for the Mooring Master and will he be allowed to use vessel\' Satellite Phone and Wifi as and when requested.' },
  { id: 46, text: 'Does your vessel have an STS Emergency Plan to mitigate contingencies and pollution; and Port Contact list as per required by SOPEP' },
  { id: 47, text: 'Have you conducted emergency drills in the last 7 days as per the guidelines of OCIMF "Ship-to-ship Transfer Guide for Petroleum, Chemicals and Liquefied Gases First Edition 2013"' },
  { id: 48, text: 'Does the vessel have a risk assessment for the STS Operation please provide a copy.' },
  { id: 49, text: 'Are all the lights on your vessel in operational condition and is the lighting adequate for STS operations?' },
  { id: 50, text: 'Is there sufficient crew for each stage of the STS operation while minimizing the potential for fatigue?' },
  { id: 51, text: 'Can you confirm the pilot boarding arrangements and MOB recovery procedures are in place (including life buoy to be ready), in good order and well understood by the crew? If no, please provide details' },
  { id: 52, text: 'Does the Master and crew have STS experience as per STS Guide section 1.8?' },
  { id: 53, text: 'What is the MARSEC level of your vessel currently maintaining' },
  { id: 54, text: 'Please confirm oil major vetting status -No of vetting approvals' },
  { id: 55, text: 'Does owner warrant that all Recognized Organization and Flag Administration Certification / requirements are valid for the intended STS Operation' },
  { id: 56, text: 'Coronavirus (COVID 19) Please advise: Is all your crewmember vaccinated against COVID 19 and not suffering from any high fever, dry cough, runny nose and breathing difficulties and not in isolation' },
  { id: 57, text: 'Owners/Operators/Charterer of the proposed vessel CONFIRM that the vessel(s) covered by this request, the direct and indirect owners of such vessel(s), the cargo, and the origin & destination of such cargo, are not identified on a list of Sanctions by United Nations Security Council, EU, UK, or US, but not limited to, on the US Department of Treasury (OFAC) List of Specially Designated Nationals.' },
];

export default function ShipStandardQuestionnaire() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // Trim trailing comma from operationRef if present
  const rawOperationRef = searchParams.get('operationRef');
  const operationRef = rawOperationRef ? rawOperationRef.replace(/,\s*$/, '').trim() : null;
  const mode = searchParams.get('mode'); // 'update' or null
  const signatureFileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    operationRef: operationRef || '',
    formNo: 'OPS-OFD-001A',
    issueDate: new Date().toISOString().split('T')[0],
    approvedBy: 'JS',
    // Basic Info
    proposedLocation: '',
    shipName: '',
    date: '',
    // Responses
    responses: {
      q1: '', q2: '', q3: '', q4: '', q5: '', q6: '', q7: '', q8: '', q9: '', q10: '',
      q11: '', q12: '', q13: '', q14: '', q15: '',
      q16: { parallelBodyArrivalDeparture: '', parallelDistanceAheadManifold: '', parallelDistanceAsternManifold: '' },
      q17: '', q18: '', q19: '', q20: '', q21: '', q22: '', q23: '', q24: '', q25: '', q26: '',
      q27: { certificateDate: '', putInUseDate: '', lastInspectionDate: '', endToEndChangeDate: '' },
      q28: { certificateDate: '', putInUseDate: '', lastInspectionDate: '' },
      q29: '', q30: '', q31: '',
      q32: {
        manifoldConnectionAvailable: '',
        reducersAvailable: '',
        maxDischargeReceivingRate: { oneManifold: '', twoManifold: '' },
        oceaneFendersRequired: '',
        maxManifoldPressureDuringTransfer: '',
        dischargeEstimatedTime: '',
        hoseThroughput: {
          hose10InGuttling: '',
          hose12InYokohama: '',
          hose8InComposite: '',
          hose10InComposite: '',
          hose12InComposite: ''
        }
      },
      q33: {
        ocimfCompliance: '',
        manifoldConnections8inch: '',
        maxRate: { oneManifold: '', twoManifold: '', threeManifold: '' }
      },
      q34: '', q35: '', q36: '', q37: '', q38: '', q39: '',
      q40: {
        cargoType: '', cargoGrade: '', cargoQuantity: '', shippers: '',
        cargoOrigin: '', destination: '', healthHazard: '', msdsProvided: ''
      },
      q41: '',
      q42: { craneCertified: '', permissionFromOwners: '', oceaneFendersAllowed: '', PersonnelTransferBasketChecklist: '' },
      q43: '', q44: '', q45: '', q46: '', q47: '', q48: '', q49: '', q50: '', q51: '', q52: '', q53: '', q54: '', q55: '',
      q56: '', q57: ''
    },
    signature: {
      name: '',
      rank: '',
      signature: '',
      date: ''
    }
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);

  // Helper function to convert technical errors to user-friendly messages
  const getUserFriendlyError = (error) => {
    if (!error) return 'An unexpected error occurred. Please try again.';
    
    const errorMessage = typeof error === 'string' ? error : error.message || '';
    const errorLower = errorMessage.toLowerCase();
    
    // Specific error codes
    if (errorMessage === 'CHECKLIST_NOT_FOUND') {
      return 'Checklist not found. Please verify the operation reference number.';
    }
    if (errorMessage === 'INVALID_RESPONSE_FORMAT') {
      return 'Invalid response from server. Please try again.';
    }
    if (errorMessage === 'NO_DATA_RECEIVED') {
      return 'No data received from server. Please try again.';
    }
    
    // Network errors
    if (errorLower.includes('fetch') || errorLower.includes('network') || errorLower.includes('connection')) {
      return 'Unable to connect to server. Please check your internet connection and try again.';
    }
    
    // Timeout errors
    if (errorLower.includes('timeout') || errorLower.includes('aborted')) {
      return 'Request took too long. Please try again.';
    }
    
    // 404 errors
    if (errorLower.includes('404') || errorLower.includes('not found')) {
      return 'Checklist not found. Please verify the operation reference number.';
    }
    
    // 500 errors
    if (errorLower.includes('500') || errorLower.includes('internal server error')) {
      return 'Server error occurred. Please try again later or contact support.';
    }
    
    // 502/503 errors
    if (errorLower.includes('502') || errorLower.includes('503') || errorLower.includes('bad gateway')) {
      return 'Service temporarily unavailable. Please try again in a few moments.';
    }
    
    // JSON parsing errors
    if (errorLower.includes('json') || errorLower.includes('parse') || errorLower.includes('invalid response')) {
      return 'Invalid response from server. Please try again.';
    }
    
    // MongoDB/ObjectId errors
    if (errorLower.includes('cast to objectid') || errorLower.includes('objectid failed')) {
      return 'Invalid operation reference format. Please check the link and try again.';
    }
    
    // Generic fallback
    if (errorMessage.length > 100 || errorMessage.includes('http://') || errorMessage.includes('localhost')) {
      return 'An error occurred while processing your request. Please try again.';
    }
    
    return errorMessage;
  };

  // Helper function to safely parse date
  const safeParseDate = (dateValue) => {
    if (!dateValue) return '';
    try {
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return '';
      return date.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  // Function to reset form to initial state (for create mode)
  const resetForm = () => {
    setFormData({
      operationRef: operationRef || '',
      formNo: 'OPS-OFD-001A',
      issueDate: new Date().toISOString().split('T')[0],
      approvedBy: 'JS',
      proposedLocation: '',
      shipName: '',
      date: '',
      responses: {
        q1: '', q2: '', q3: '', q4: '', q5: '', q6: '', q7: '', q8: '', q9: '', q10: '',
        q11: '', q12: '', q13: '', q14: '', q15: '',
        q16: { parallelBodyArrivalDeparture: '', parallelDistanceAheadManifold: '', parallelDistanceAsternManifold: '' },
        q17: '', q18: '', q19: '', q20: '', q21: '', q22: '', q23: '', q24: '', q25: '', q26: '',
        q27: { certificateDate: '', putInUseDate: '', lastInspectionDate: '', endToEndChangeDate: '' },
        q28: { certificateDate: '', putInUseDate: '', lastInspectionDate: '' },
        q29: '', q30: '', q31: '',
        q32: {
          manifoldConnectionAvailable: '',
          reducersAvailable: '',
          maxDischargeReceivingRate: { oneManifold: '', twoManifold: '' },
          oceaneFendersRequired: '',
          maxManifoldPressureDuringTransfer: '',
          dischargeEstimatedTime: '',
          hoseThroughput: {
            hose10InGuttling: '',
            hose12InYokohama: '',
            hose8InComposite: '',
            hose10InComposite: '',
            hose12InComposite: ''
          }
        },
        q33: {
          ocimfCompliance: '',
          manifoldConnections8inch: '',
          maxRate: { oneManifold: '', twoManifold: '', threeManifold: '' }
        },
        q34: '', q35: '', q36: '', q37: '', q38: '', q39: '',
        q40: {
          cargoType: '', cargoGrade: '', cargoQuantity: '', shippers: '',
          cargoOrigin: '', destination: '', healthHazard: '', msdsProvided: ''
        },
        q41: '',
        q42: { craneCertified: '', permissionFromOwners: '', oceaneFendersAllowed: '', PersonnelTransferBasketChecklist: '' },
        q43: '', q44: '', q45: '', q46: '', q47: '', q48: '', q49: '', q50: '', q51: '', q52: '', q53: '', q54: '', q55: '',
        q56: '', q57: ''
      },
      signature: {
        name: '',
        rank: '',
        signature: '',
        date: ''
      }
    });
    // Reset file input
    if (signatureFileInputRef.current) {
      signatureFileInputRef.current.value = '';
    }
  };

  // Function to reset form completely and clear URL params (for update mode after submission)
  const resetFormToCreateMode = () => {
    setFormData({
      operationRef: '',
      formNo: 'OPS-OFD-001A',
      issueDate: new Date().toISOString().split('T')[0],
      approvedBy: 'JS',
      proposedLocation: '',
      shipName: '',
      date: '',
      responses: {
        q1: '', q2: '', q3: '', q4: '', q5: '', q6: '', q7: '', q8: '', q9: '', q10: '',
        q11: '', q12: '', q13: '', q14: '', q15: '',
        q16: { parallelBodyArrivalDeparture: '', parallelDistanceAheadManifold: '', parallelDistanceAsternManifold: '' },
        q17: '', q18: '', q19: '', q20: '', q21: '', q22: '', q23: '', q24: '', q25: '', q26: '',
        q27: { certificateDate: '', putInUseDate: '', lastInspectionDate: '', endToEndChangeDate: '' },
        q28: { certificateDate: '', putInUseDate: '', lastInspectionDate: '' },
        q29: '', q30: '', q31: '',
        q32: {
          manifoldConnectionAvailable: '',
          reducersAvailable: '',
          maxDischargeReceivingRate: { oneManifold: '', twoManifold: '' },
          oceaneFendersRequired: '',
          maxManifoldPressureDuringTransfer: '',
          dischargeEstimatedTime: '',
          hoseThroughput: {
            hose10InGuttling: '',
            hose12InYokohama: '',
            hose8InComposite: '',
            hose10InComposite: '',
            hose12InComposite: ''
          }
        },
        q33: {
          ocimfCompliance: '',
          manifoldConnections8inch: '',
          maxRate: { oneManifold: '', twoManifold: '', threeManifold: '' }
        },
        q34: '', q35: '', q36: '', q37: '', q38: '', q39: '',
        q40: {
          cargoType: '', cargoGrade: '', cargoQuantity: '', shippers: '',
          cargoOrigin: '', destination: '', healthHazard: '', msdsProvided: ''
        },
          q41: '',
          q42: { craneCertified: '', permissionFromOwners: '', oceaneFendersAllowed: '', PersonnelTransferBasketChecklist: '' },
          q43: '', q44: '', q45: '', q46: '', q47: '', q48: '', q49: '', q50: '', q51: '', q52: '', q53: '', q54: '', q55: '',
          q56: '', q57: ''
        },
        signature: {
          name: '',
          rank: '',
          signature: '',
          date: ''
        }
      });
      // Reset file input
      if (signatureFileInputRef.current) {
        signatureFileInputRef.current.value = '';
      }
      // Clear update mode
      setIsUpdateMode(false);
      // Clear URL parameters
      router.replace('/OPS-OFD-001A');
    };

  // Function to fetch existing data for update mode
  const fetchExistingData = async (refNumber) => {
    try {
      setLoadingData(true);
      setSubmitError(null);
      
      // Trim trailing comma and whitespace
      const trimmedRef = refNumber?.replace(/,\s*$/, '').trim();
      
      if (!trimmedRef) {
        throw new Error('Operation reference is required');
      }
      
      // URL encode the operationRef
      const encodedRef = encodeURIComponent(trimmedRef);
      const res = await fetch(`/api/sts-proxy/ops-ofd-001a?operationRef=${encodedRef}`);
      
      // Handle 404 specifically (data not found)
      if (res.status === 404) {
        throw new Error('CHECKLIST_NOT_FOUND');
      }
      
      // Parse response
      const contentType = res.headers.get("content-type");
      let responseData;
      
      try {
        if (contentType?.includes("application/json")) {
          responseData = await res.json();
        } else {
          const text = await res.text();
          try {
            responseData = JSON.parse(text);
          } catch {
            throw new Error('INVALID_RESPONSE_FORMAT');
          }
        }
      } catch (parseError) {
        throw new Error('INVALID_RESPONSE_FORMAT');
      }
      
      if (!res.ok) {
        const errorMsg = responseData?.error || responseData?.message || `Failed to fetch data: ${res.status}`;
        throw new Error(errorMsg);
      }
      
      const data = responseData.data || responseData;
      
      if (!data) {
        throw new Error('NO_DATA_RECEIVED');
      }
      
      // Clean operationRef from data
      const cleanOperationRef = (data.operationRef || trimmedRef || '')?.replace(/,\s*$/, '').trim();
      
      // Populate form with fetched data (handle both nested and flat structure for backward compatibility)
      setFormData({
        operationRef: cleanOperationRef || '',
        formNo: (data.documentInfo?.formNo || data.formNo || 'OPS-OFD-001A')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-001A',
        issueDate: safeParseDate(data.documentInfo?.revisionDate || data.revisionDate || data.issueDate) || new Date().toISOString().split('T')[0],
        approvedBy: data.documentInfo?.approvedBy || data.approvedBy || 'JS',
        proposedLocation: data.basicInfo?.proposedLocation || data.proposedLocation || '',
        shipName: data.basicInfo?.shipName || data.shipName || '',
        date: safeParseDate(data.basicInfo?.date || data.date) || '',
        responses: data.responses || {
          q1: '', q2: '', q3: '', q4: '', q5: '', q6: '', q7: '', q8: '', q9: '', q10: '',
          q11: '', q12: '', q13: '', q14: '', q15: '',
          q16: { parallelBodyArrivalDeparture: '', parallelDistanceAheadManifold: '', parallelDistanceAsternManifold: '' },
          q17: '', q18: '', q19: '', q20: '', q21: '', q22: '', q23: '', q24: '', q25: '', q26: '',
          q27: { certificateDate: '', putInUseDate: '', lastInspectionDate: '', endToEndChangeDate: '' },
          q28: { certificateDate: '', putInUseDate: '', lastInspectionDate: '' },
          q29: '', q30: '', q31: '',
          q32: {
            manifoldConnectionAvailable: '',
            reducersAvailable: '',
            maxDischargeReceivingRate: { oneManifold: '', twoManifold: '' },
            oceaneFendersRequired: '',
            maxManifoldPressureDuringTransfer: '',
            dischargeEstimatedTime: '',
            hoseThroughput: {
              hose10InGuttling: '',
              hose12InYokohama: '',
              hose8InComposite: '',
              hose10InComposite: '',
              hose12InComposite: ''
            }
          },
          q33: {
            ocimfCompliance: '',
            manifoldConnections8inch: '',
            maxRate: { oneManifold: '', twoManifold: '', threeManifold: '' }
          },
          q34: '', q35: '', q36: '', q37: '', q38: '', q39: '',
          q40: {
            cargoType: '', cargoGrade: '', cargoQuantity: '', shippers: '',
            cargoOrigin: '', destination: '', healthHazard: '', msdsProvided: ''
          },
          q41: '',
          q42: { 
            craneCertified: data.responses?.q42?.craneCertified || '', 
            permissionFromOwners: data.responses?.q42?.permissionFromOwners || '', 
            oceaneFendersAllowed: data.responses?.q42?.oceaneFendersAllowed || '', 
            PersonnelTransferBasketChecklist: data.responses?.q42?.PersonnelTransferBasketChecklist || '' 
          },
          q43: '', q44: '', q45: '', q46: '', q47: '', q48: '', q49: '', q50: '', q51: '', q52: '', q53: '', q54: '', q55: '',
          q56: '', q57: ''
        },
        signature: {
          name: data.signature?.name || '',
          rank: data.signature?.rank || '',
          signature: getSignatureUrl(data.signature?.signature || ''),
          date: safeParseDate(data.signature?.date) || '',
        },
      });
    } catch (err) {
      const userFriendlyError = getUserFriendlyError(err);
      setSubmitError(userFriendlyError);
      console.error('Error fetching existing data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  // Check for mode and operationRef on component mount
  useEffect(() => {
    if (operationRef) {
      setFormData(prev => ({
        ...prev,
        operationRef
      }));
    }
    
    // Check if mode is 'update'
    if (mode === 'update' && operationRef) {
      setIsUpdateMode(true);
      fetchExistingData(operationRef);
    }
  }, [operationRef, mode]);

  const handleBasicInfoChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleResponseChange = (questionId, value, subField = null) => {
    const updatedResponses = { ...formData.responses };
    const qKey = `q${questionId}`;

    if (subField) {
      if (!updatedResponses[qKey]) updatedResponses[qKey] = {};
      updatedResponses[qKey][subField] = value;
    } else {
      updatedResponses[qKey] = value;
    }

    setFormData({ ...formData, responses: updatedResponses });
  };

  const handleNestedResponseChange = (questionId, parentField, subField, value) => {
    const updatedResponses = { ...formData.responses };
    const qKey = `q${questionId}`;
    if (!updatedResponses[qKey]) updatedResponses[qKey] = {};
    if (!updatedResponses[qKey][parentField]) updatedResponses[qKey][parentField] = {};
    updatedResponses[qKey][parentField][subField] = value;
    setFormData({ ...formData, responses: updatedResponses });
  };

  const handleSignatureChange = (field, value) => {
    setFormData({
      ...formData,
      signature: {
        ...formData.signature,
        [field]: value,
      },
    });
  };

  const handleSignatureUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        handleSignatureChange('signature', base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  // Show loading state while fetching data
  if (loadingData) {
    return (
      <div className="min-h-screen relative">
        {/* Background image with blur */}
        <div 
          className="fixed inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url(/image/background.img)',
            // filter: 'blur(3px)',
            zIndex: 0
          }}
        />
        {/* Overlay for better contrast */}
        <div className="fixed inset-0 bg-gray-900/75 z-10" />
        {/* Content */}
        <div className="relative z-20 min-h-screen text-white p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto bg-gray-800/95 rounded-lg shadow-2xl p-4 sm:p-6 lg:p-8 backdrop-blur-sm">
            <div className="flex items-center justify-center py-12 sm:py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p className="text-white/60 text-sm sm:text-base">Loading existing data...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitSuccess) return;
    if (!formData.operationRef) {
      setSubmitError("Invalid operation reference. Please use valid link.");
      return;
    }

    if (submitting) return;
    try {
      setSubmitting(true);
      setSubmitError(null);
      setSubmitSuccess(false);
      
      // Clean operationRef (remove trailing comma if present)
      const cleanOperationRef = (formData.operationRef || '')?.replace(/,\s*$/, '').trim();
      
      if (!cleanOperationRef) {
        setSubmitError("Operation reference is required. Please check the link you received.");
        setSubmitting(false);
        return;
      }

      const payload = {
        operationRef: cleanOperationRef,
        documentInfo: {
          formNo: (formData.formNo || 'OPS-OFD-001A')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-001A',
          revisionDate: formData.issueDate || null,
          approvedBy: formData.approvedBy || 'JS',
        },
        basicInfo: {
          proposedLocation: formData.proposedLocation || '',
          shipName: formData.shipName || '',
          date: formData.date || null,
        },
        responses: formData.responses || {},
        signature: formData.signature || {},
        status: "DRAFT"
      };

      const form = new FormData();
      form.append("data", JSON.stringify(payload));

      // Use PUT for update mode, POST for create mode
      const method = isUpdateMode ? "PUT" : "POST";
      const encodedRef = encodeURIComponent(cleanOperationRef);
      const url = isUpdateMode 
        ? `/api/sts-proxy/ops-ofd-001a?operationRef=${encodedRef}`
        : "/api/sts-proxy/ops-ofd-001a/create";

      let res;
      try {
        res = await fetch(url, {
          method: method,
          body: form
        });
      } catch (fetchError) {
        if (fetchError.name === 'TypeError' && fetchError.message.includes('fetch')) {
          throw new Error('Network error: Unable to connect to server. Please check your connection.');
        }
        throw fetchError;
      }

      // Parse response
      const contentType = res.headers.get("content-type");
      let responseData;
      
      try {
        if (contentType?.includes("application/json")) {
          responseData = await res.json();
        } else {
          const text = await res.text();
          try {
            responseData = JSON.parse(text);
          } catch {
            throw new Error(text || `Server error: ${res.status} ${res.statusText}`);
          }
        }
      } catch (parseError) {
        throw new Error(parseError.message || `Server error: ${res.status} ${res.statusText}`);
      }

      if (!res.ok) {
        const errorMsg = responseData?.error || responseData?.message || `Submission failed: ${res.status} ${res.statusText}`;
        throw new Error(errorMsg);
      }

      setSubmitSuccess(true);
      // Reset form after successful submission
      if (isUpdateMode) {
        // After update, reset to create mode and clear URL params
        resetFormToCreateMode();
      } else {
        // After create, just reset form (keep operationRef if in URL)
        resetForm();
      }

    } catch (err) {
      // Convert technical error to user-friendly message
      const userFriendlyError = getUserFriendlyError(err);
      setSubmitError(userFriendlyError);
      console.error('Error submitting questionnaire:', err);
    } finally {
      setSubmitting(false);
    }
  };


  const renderQuestion = (question) => {
    const qKey = `q${question.id}`;
    const response = formData.responses[qKey];

    if (question.id === 16) {
      return (
        <div key={question.id} className="mb-6">
          <div className="mb-2">
            <span className="font-semibold">Item {question.id}:</span> {question.text}
          </div>
          {question.subParts?.map((subPart, idx) => (
            <div key={idx} className="ml-4 mb-3">
              <div className="text-sm mb-1">{subPart}</div>
              <textarea
                value={response?.[idx === 0 ? 'parallelBodyArrivalDeparture' : idx === 1 ? 'parallelDistanceAheadManifold' : 'parallelDistanceAsternManifold'] || ''}
                onChange={(e) => handleResponseChange(question.id, e.target.value, idx === 0 ? 'parallelBodyArrivalDeparture' : idx === 1 ? 'parallelDistanceAheadManifold' : 'parallelDistanceAsternManifold')}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                rows="2"
                placeholder="Vessel's Reply:"
              />
            </div>
          ))}
        </div>
      );
    }

    if (question.id === 27 || question.id === 28) {
      return (
        <div key={question.id} className="mb-6">
          <div className="mb-2">
            <span className="font-semibold">Item {question.id}:</span> {question.text}
          </div>
          <div className="ml-4 space-y-2">
            {question.id === 27 && (
              <>
                <div>
                  <label className="text-sm mb-1 block">(Date of Certificate):</label>
                  <input
                    type="date"
                    value={response?.certificateDate || ''}
                    onChange={(e) => handleResponseChange(question.id, e.target.value, 'certificateDate')}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm mb-1 block">(Date put in use):</label>
                  <input
                    type="date"
                    value={response?.putInUseDate || ''}
                    onChange={(e) => handleResponseChange(question.id, e.target.value, 'putInUseDate')}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm mb-1 block">(Date of Last inspection):</label>
                  <input
                    type="date"
                    value={response?.lastInspectionDate || ''}
                    onChange={(e) => handleResponseChange(question.id, e.target.value, 'lastInspectionDate')}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm mb-1 block">(Date of End to End change):</label>
                  <input
                    type="date"
                    value={response?.endToEndChangeDate || ''}
                    onChange={(e) => handleResponseChange(question.id, e.target.value, 'endToEndChangeDate')}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
              </>
            )}
            {question.id === 28 && (
              <>
                <div>
                  <label className="text-sm mb-1 block">(Date of Certificate):</label>
                  <input
                    type="date"
                    value={response?.certificateDate || ''}
                    onChange={(e) => handleResponseChange(question.id, e.target.value, 'certificateDate')}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm mb-1 block">(Date put in use):</label>
                  <input
                    type="date"
                    value={response?.putInUseDate || ''}
                    onChange={(e) => handleResponseChange(question.id, e.target.value, 'putInUseDate')}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm mb-1 block">(Last inspection date):</label>
                  <input
                    type="date"
                    value={response?.lastInspectionDate || ''}
                    onChange={(e) => handleResponseChange(question.id, e.target.value, 'lastInspectionDate')}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      );
    }

    if (question.id === 32) {
      return (
        <div key={question.id} className="mb-6 bg-gray-700 p-4 rounded">
          <div className="font-semibold mb-4">Item {question.id}: {question.text}</div>
          <div className="space-y-4">
            <div>
              <label className="text-sm mb-1 block">Please confirm if the vessel can provide manifold connection as mentioned in the pre-arrival message and confirm size of your manifold hose connections:</label>
              <textarea
                value={response?.manifoldConnectionAvailable || ''}
                onChange={(e) => handleResponseChange(question.id, e.target.value, 'manifoldConnectionAvailable')}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                rows="2"
              />
            </div>
            <div>
              <label className="text-sm mb-1 block">Kindly advise us of the number and size of reducers that are available:</label>
              <textarea
                value={response?.reducersAvailable || ''}
                onChange={(e) => handleResponseChange(question.id, e.target.value, 'reducersAvailable')}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                rows="2"
              />
            </div>
            <div>
              <label className="text-sm mb-1 block">For this cargo, please advise vessel's maximum discharging/receiving rate using:</label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs mb-1 block">1 Manifold:</label>
                  <input
                    type="text"
                    value={response?.maxDischargeReceivingRate?.oneManifold || ''}
                    onChange={(e) => handleNestedResponseChange(question.id, 'maxDischargeReceivingRate', 'oneManifold', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block">2 Manifolds:</label>
                  <input
                    type="text"
                    value={response?.maxDischargeReceivingRate?.twoManifold || ''}
                    onChange={(e) => handleNestedResponseChange(question.id, 'maxDischargeReceivingRate', 'twoManifold', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm mb-1 block">Please advise if you require Oceane Fenders to provide suitable reducers:</label>
              <textarea
                value={response?.oceaneFendersRequired || ''}
                onChange={(e) => handleResponseChange(question.id, e.target.value, 'oceaneFendersRequired')}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                rows="2"
              />
            </div>
            <div>
              <label className="text-sm mb-1 block">During the cargo transfer what is the maximum pressure at manifold expected to be during cargo transfer:</label>
              <textarea
                value={response?.maxManifoldPressureDuringTransfer || ''}
                onChange={(e) => handleResponseChange(question.id, e.target.value, 'maxManifoldPressureDuringTransfer')}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                rows="2"
              />
            </div>
            <div>
              <label className="text-sm mb-1 block">Discharging Vessel – Please confirm estimated discharge time including stripping as applicable:</label>
              <textarea
                value={response?.dischargeEstimatedTime || ''}
                onChange={(e) => handleResponseChange(question.id, e.target.value, 'dischargeEstimatedTime')}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                rows="2"
              />
            </div>
            <div>
              <label className="text-sm mb-2 block font-semibold">Hose Throughput Information:</label>
              <div className="space-y-3">
                <div>
                  <label className="text-xs mb-1 block text-gray-300">
                    With a 10" Guttleling hose string (Max. throughput = 2736m3/hr Per String):
                  </label>
                  <input
                    type="text"
                    value={response?.hoseThroughput?.hose10InGuttling || ''}
                    onChange={(e) => handleNestedResponseChange(question.id, 'hoseThroughput', 'hose10InGuttling', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                    placeholder="Enter reply..."
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block text-gray-300">
                    With a 12" Yokohama hose string (Max. throughput = 3945m3/hr Per String):
                  </label>
                  <input
                    type="text"
                    value={response?.hoseThroughput?.hose12InYokohama || ''}
                    onChange={(e) => handleNestedResponseChange(question.id, 'hoseThroughput', 'hose12InYokohama', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                    placeholder="Enter reply..."
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block text-gray-300">
                    With an 8" Composite hose string (Max. throughput = 1398m3/hr Per String):
                  </label>
                  <input
                    type="text"
                    value={response?.hoseThroughput?.hose8InComposite || ''}
                    onChange={(e) => handleNestedResponseChange(question.id, 'hoseThroughput', 'hose8InComposite', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                    placeholder="Enter reply..."
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block text-gray-300">
                    With a 10" Composite hose string (Max. throughput = 2189m3/hr Per String):
                  </label>
                  <input
                    type="text"
                    value={response?.hoseThroughput?.hose10InComposite || ''}
                    onChange={(e) => handleNestedResponseChange(question.id, 'hoseThroughput', 'hose10InComposite', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                    placeholder="Enter reply..."
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block text-gray-300">
                    With a 12" Composite hose string (Max. throughput = 3157m3/hr Per String):
                  </label>
                  <input
                    type="text"
                    value={response?.hoseThroughput?.hose12InComposite || ''}
                    onChange={(e) => handleNestedResponseChange(question.id, 'hoseThroughput', 'hose12InComposite', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                    placeholder="Enter reply..."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (question.id === 33) {
      return (
        <div key={question.id} className="mb-6 bg-gray-700 p-4 rounded">
          <div className="font-semibold mb-4">Item {question.id}: {question.text}</div>
          <div className="space-y-4">
            <div>
              <label className="text-sm mb-1 block">Does the vessel comply with the OCIMF 'Recommendations for manifolds of refrigerated liquid gas carriers for cargoes from 0 Deg C to Minus 104 Deg C':</label>
              <textarea
                value={response?.ocimfCompliance || ''}
                onChange={(e) => handleResponseChange(question.id, e.target.value, 'ocimfCompliance')}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                rows="2"
              />
            </div>
            <div>
              <label className="text-sm mb-1 block">Is the vessel being able to present 2 manifold hose connections of 8" ANSI 300 or 150ANSI standards:</label>
              <textarea
                value={response?.manifoldConnections8inch || ''}
                onChange={(e) => handleResponseChange(question.id, e.target.value, 'manifoldConnections8inch')}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                rows="2"
              />
            </div>
            <div>
              <label className="text-sm mb-1 block">For this cargo, please advise the vessels maximum discharging/receiving rate using:</label>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs mb-1 block">1 Manifold:</label>
                  <input
                    type="text"
                    value={response?.maxRate?.oneManifold || ''}
                    onChange={(e) => handleNestedResponseChange(question.id, 'maxRate', 'oneManifold', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block">2 Manifolds:</label>
                  <input
                    type="text"
                    value={response?.maxRate?.twoManifold || ''}
                    onChange={(e) => handleNestedResponseChange(question.id, 'maxRate', 'twoManifold', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs mb-1 block">3 Manifolds:</label>
                  <input
                    type="text"
                    value={response?.maxRate?.threeManifold || ''}
                    onChange={(e) => handleNestedResponseChange(question.id, 'maxRate', 'threeManifold', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (question.id === 40) {
      return (
        <div key={question.id} className="mb-6 bg-gray-700 p-4 rounded">
          <div className="font-semibold mb-4">Item {question.id}: {question.text}</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm mb-1 block">Cargo Type:</label>
              <input
                type="text"
                value={response?.cargoType || ''}
                onChange={(e) => handleResponseChange(question.id, e.target.value, 'cargoType')}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-sm mb-1 block">Grade of Cargo:</label>
              <input
                type="text"
                value={response?.cargoGrade || ''}
                onChange={(e) => handleResponseChange(question.id, e.target.value, 'cargoGrade')}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-sm mb-1 block">Cargo Quantity:</label>
              <input
                type="text"
                value={response?.cargoQuantity || ''}
                onChange={(e) => handleResponseChange(question.id, e.target.value, 'cargoQuantity')}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-sm mb-1 block">Shippers (as per BOL):</label>
              <input
                type="text"
                value={response?.shippers || ''}
                onChange={(e) => handleResponseChange(question.id, e.target.value, 'shippers')}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-sm mb-1 block">Cargo Origin:</label>
              <input
                type="text"
                value={response?.cargoOrigin || ''}
                onChange={(e) => handleResponseChange(question.id, e.target.value, 'cargoOrigin')}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-sm mb-1 block">Destination:</label>
              <input
                type="text"
                value={response?.destination || ''}
                onChange={(e) => handleResponseChange(question.id, e.target.value, 'destination')}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="text-sm mb-1 block">Any Specific Health Hazard of Cargo:</label>
              <textarea
                value={response?.healthHazard || ''}
                onChange={(e) => handleResponseChange(question.id, e.target.value, 'healthHazard')}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                rows="2"
              />
            </div>
            <div>
              <label className="text-sm mb-1 block">Please provide MSDS:</label>
              <textarea
                value={response?.msdsProvided || ''}
                onChange={(e) => handleResponseChange(question.id, e.target.value, 'msdsProvided')}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                rows="2"
                placeholder="Yes/No or provide details"
              />
            </div>
          </div>
        </div>
      );
    }

    if (question.id === 42) {
      return (
        <div key={question.id} className="mb-6 bg-gray-700 p-4 rounded">
          <div className="font-semibold mb-4">Item {question.id}: {question.text}</div>
          <div className="space-y-4">
            <div>
              <label className="text-sm mb-1 block">Is the crane certified for the transfer of personnel and in compliance with the Checklist in App F of the OCIMF STS Guide (4 man) & is within test date:</label>
              <textarea
                value={response?.craneCertified || ''}
                onChange={(e) => handleResponseChange(question.id, e.target.value, 'craneCertified')}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                rows="2"
              />
            </div>
            <div>
              <label className="text-sm mb-1 block">Do you have permission of the owners and charterers to use:</label>
              <textarea
                value={response?.permissionFromOwners || ''}
                onChange={(e) => handleResponseChange(question.id, e.target.value, 'permissionFromOwners')}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                rows="2"
              />
            </div>
            <div>
              <label className="text-sm mb-1 block">Kindly confirm if Oceane Fenders can utilize it during STS Ops:</label>
              <textarea
                value={response?.oceaneFendersAllowed || ''}
                onChange={(e) => handleResponseChange(question.id, e.target.value, 'oceaneFendersAllowed')}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                rows="2"
              />
            </div>
            <div>
              <label className="text-sm mb-1 block">Personnel Transfer Basket Checklist:</label>
              <textarea
                value={response?.PersonnelTransferBasketChecklist || ''}
                onChange={(e) => handleResponseChange(question.id, e.target.value, 'PersonnelTransferBasketChecklist')}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
                rows="2"
                placeholder="Enter details about Personnel Transfer Basket Checklist"
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={question.id} className="mb-6">
        <div className="mb-2">
          <span className="font-semibold">Item {question.id}:</span> {question.text}
        </div>
        <div className="ml-4">
          <label className="text-sm mb-1 block">Vessel's Reply:</label>
          <textarea
            value={typeof response === 'string' ? response : ''}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            rows="3"
            placeholder="Enter your reply..."
          />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen relative">
      {/* Background image with blur */}
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/image/background.img)',
          // filter: 'blur(3px)',
          zIndex: 0
        }}
      />
      {/* Overlay for better contrast */}
      <div className="fixed inset-0 bg-gray-900/75 z-10" />
      {/* Content */}
      <div className="relative z-20 min-h-screen text-white p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto bg-gray-800/95 rounded-lg shadow-2xl p-4 sm:p-6 lg:p-8 backdrop-blur-sm">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start mb-6 lg:mb-8 border-b border-gray-700 pb-4 lg:pb-6 gap-4 lg:gap-0">
          <div className="relative w-32 h-16 sm:w-40 sm:h-18 lg:w-48 lg:h-20 mx-auto lg:mx-0">
            <Image
              src="/image/logo.png"
              alt="OCEANE GROUP - SHIP-TO-SHIP TRANSFER"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div className="flex-1 flex flex-col items-center text-center px-2">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold mb-1 sm:mb-2">
              SHIP'S STANDARD QUESTIONNAIRE
            </h1>
            <h2 className="text-base sm:text-lg lg:text-xl font-semibold">
              OPS-OFD-001A
            </h2>
            {isUpdateMode && (
              <div className="mt-2 px-3 sm:px-4 py-1 bg-yellow-600/30 border border-yellow-500 rounded text-yellow-300 text-xs sm:text-sm font-semibold">
                EDIT MODE
              </div>
            )}
          </div>
          <div className="bg-gray-700 p-3 sm:p-4 rounded w-full lg:w-auto lg:min-w-[200px] mx-auto lg:mx-0">
            <div className="text-xs sm:text-sm space-y-1">
              <div><strong>Form No:</strong> {formData.formNo}</div>
              <div><strong>Issue Date:</strong> {formData.issueDate}</div>
              <div><strong>Approved by:</strong> {formData.approvedBy}</div>
              <div className="text-blue-300 mt-2">
                <b>Operation Ref:</b> {formData.operationRef || "Loading..."}
              </div>
            </div>
          </div>
        </div>

        {/* Basic Info Section */}
        <div className="mb-6 sm:mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm mb-1">Proposed Location:</label>
              <input
                type="text"
                value={formData.proposedLocation}
                onChange={(e) => handleBasicInfoChange('proposedLocation', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="Enter Location"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Ship's Name:</label>
              <input
                type="text"
                value={formData.shipName}
                onChange={(e) => handleBasicInfoChange('shipName', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="Enter Ship's Name"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Date:</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleBasicInfoChange('date', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>

        {/* Introduction Text */}
        <div className="mb-8 p-4 bg-gray-700 rounded">
          <p className="text-sm">
            The questionnaire below is specifically based on the guidelines by ICS/OCIMF and to be submitted by each vessel involved in cargo transfer.
          </p>
        </div>

        {/* Questions Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Questionnaire</h3>
          <div className="space-y-4">
            {QUESTIONS.map(question => renderQuestion(question))}
          </div>
        </div>

        {/* Signature Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Signature</h3>
          <div className="bg-gray-700 p-6 rounded">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm mb-1">Name:</label>
                <input
                  type="text"
                  value={formData.signature.name}
                  onChange={(e) => handleSignatureChange('name', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Rank:</label>
                <input
                  type="text"
                  value={formData.signature.rank}
                  onChange={(e) => handleSignatureChange('rank', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">Signature:</label>
                <input
                  ref={signatureFileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleSignatureUpload}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 sm:px-3 py-2 text-white text-xs sm:text-sm file:mr-2 sm:file:mr-4 file:py-1 sm:file:py-2 file:px-2 sm:file:px-4 file:rounded file:border-0 file:text-xs sm:file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                />
                {formData.signature.signature && (
                  <div className="mt-2">
                    <img
                      src={formData.signature.signature}
                      alt="Signature preview"
                      className="max-w-full h-24 border border-gray-600 rounded object-contain bg-gray-700"
                      onError={(e) => {
                        const img = e.target;
                        img.style.display = 'none';
                        if (!img.parentElement.querySelector('.signature-error')) {
                          const errorDiv = document.createElement('div');
                          errorDiv.className = 'signature-error text-xs text-gray-400 italic p-2 bg-gray-700 rounded';
                          errorDiv.textContent = 'Signature image could not be loaded';
                          img.parentElement.appendChild(errorDiv);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleSignatureChange('signature', '')}
                      className="mt-2 text-xs sm:text-sm text-red-400 hover:text-red-300"
                    >
                      Remove Signature
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm mb-1">Date:</label>
                <input
                  type="date"
                  value={formData.signature.date}
                  onChange={(e) => handleSignatureChange('date', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mb-8 text-sm italic text-gray-400 text-center">
          <p>Disclaimer: The content of this questionnaire has been only checked by Oceane group; we have no liability for the content of the information submitted onto this document.</p>
        </div>

        {/* Submit error */}
        {submitError && (
          <div className="mb-4 p-3 sm:p-4 bg-red-900/30 border border-red-600 rounded text-red-300 text-xs sm:text-sm">
            <div className="flex items-start gap-2">
              <span className="text-red-400">⚠️</span>
              <div>
                <strong className="block mb-1">Error:</strong>
                {submitError}
              </div>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting || submitSuccess}
            className="px-4 sm:px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
          >
            {submitting 
              ? 'Submitting...' 
              : isUpdateMode 
                ? 'Update Questionnaire' 
                : 'Submit Questionnaire'}
          </button>
        </div>
        {submitSuccess && (
          <div className="mt-4 p-3 sm:p-4 bg-green-900/30 border border-green-600 rounded text-green-300 text-xs sm:text-sm">
            ✓ {isUpdateMode ? 'Questionnaire updated successfully!' : 'Form submitted successfully.'}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
