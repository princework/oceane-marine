'use client';

import { useState, useEffect, useRef, Fragment } from 'react';
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

// Helper function to extract base64 from data URL
const extractBase64 = (dataUrl) => {
    if (!dataUrl) return '';
    if (dataUrl.startsWith('data:')) {
        return dataUrl.split(',')[1] || dataUrl;
    }
    return dataUrl;
};

// CL 4A Generic Checks (1-26)
const CHECKLIST_4A = [
  { clNumber: 1, description: 'Local requirements including permissions are obtained and complied with OCIMF', hasNotApplicable: false },
  { clNumber: 2, description: 'JPO procedures for cargo and ballast operations reviewed and agreed by all parties.', hasNotApplicable: false },
  { clNumber: 3, description: 'Present and forecast weather and sea conditions are within the agreed limits.', hasNotApplicable: false },
  { clNumber: 4, description: 'Cargo specifications, hazardous properties, SDS and any requirements for inerting, heating, reactivity and inhibitors have been exchanged.', hasNotApplicable: false },
  { clNumber: 5, description: 'Tank venting system and closed operation procedures agreed', hasNotApplicable: false },
  { clNumber: 6, description: 'Procedures for vapour control/balancing have been agreed.', hasNotApplicable: false },
  { clNumber: 7, description: 'Procedures for the transfer of personnel have been agreed.', hasNotApplicable: false },
  { clNumber: 8, description: 'All personnel engaged in the cargo operation are provided with PPE including, where necessary, personal gas detectors/monitors in accordance with the ship operator\'s PPE matrix.', hasNotApplicable: false },
  { clNumber: 9, description: 'Cargo transfer and, if applicable, the vapour return equipment is: In good condition Of the appropriate type Properly fitted with gaskets/seals Lined up correctly Properly rigged Secured to the manifolds Sufficiently supported', hasNotApplicable: false },
  { clNumber: 10, description: 'Electrical insulation of the ship/ship interface is effective.', hasNotApplicable: false },
  { clNumber: 11, description: 'Effective STS communications established.', hasNotApplicable: false },
  { clNumber: 12, description: 'Emergency signals and shutdown procedures are agreed.', hasNotApplicable: false },
  { clNumber: 13, description: 'The engine room will be manned and the main engine kept on standby or on short notice of readiness', hasNotApplicable: false },
  { clNumber: 14, description: 'Officers in charge of the cargo transfer on both ships are identified, and details have been exchanged and posted.', hasNotApplicable: false },
  { clNumber: 15, description: 'Procedures for cargo and ballast handling operations and transfer parameters agreed.', hasNotApplicable: false },
  { clNumber: 16, description: 'Simultaneous Operations (SIMOPS) are identified and agreed', hasNotApplicable: false, isSimops: true },
  { clNumber: 17, description: 'Messengers and toggle pins are prepared and positioned ready for unmooring in accordance with the unmooring plan.', hasNotApplicable: false },
  { clNumber: 18, description: 'Means of emergency escape from both ships are established.', hasNotApplicable: false },
  { clNumber: 19, description: 'STS operation supervision and watchkeeping is adequate', hasNotApplicable: false },
  { clNumber: 20, description: 'There are sufficient personnel to deal with an emergency.', hasNotApplicable: false },
  { clNumber: 21, description: 'Naked lights, smoking restrictions and designated smoking areas are established', hasNotApplicable: false },
  { clNumber: 22, description: 'Control of electrical and electronic devices is agreed', hasNotApplicable: false },
  { clNumber: 23, description: 'Routine for regular checks and exchange of information on cargo transferred are agreed.', hasNotApplicable: false },
  { clNumber: 24, description: 'The procedure for stopping transfer are agreed', hasNotApplicable: false },
  { clNumber: 25, description: 'Cargo and vapour balancing hoses are supported and protected from chafing and the hose release area is clear of obstructions.', hasNotApplicable: false },
  { clNumber: 26, description: 'Tools required for rapid disconnection are located at the cargo manifold.', hasNotApplicable: false },
];

// SIMOPS items
const SIMOPS_ITEMS = [
  'Nitrogen purging or inerting',
  'Repairs/maintenance',
  'Tank cleaning',
  'COW',
  'Slops discharge',
  'Waste discharge',
  'Bunkering',
  'Receiving stores',
  'Personnel transfer',
  'Crew change',
  'Planned drills',
];

// CL 4B Vapor Balancing (1-18)
const CHECKLIST_4B = [
  { clNumber: 1, description: 'Confirm ship\'s vapour headers, manifolds and all piping are drained of liquid', hasNotApplicable: false },
  { clNumber: 2, description: 'Confirm all vapour headers are vapour tight before hose connection', hasNotApplicable: false },
  { clNumber: 3, description: 'State pressure in cargo tanks (mm WG or psi)', hasNotApplicable: false },
  { clNumber: 4, description: 'Tank oxygen content is below 8% by volume', hasNotApplicable: false },
  { clNumber: 5, description: 'Tank high-level and overfill alarms have been tested within the last 24 hours', hasNotApplicable: false },
  { clNumber: 6, description: 'Vapour recovery/balancing valves are correctly set', hasNotApplicable: false },
  { clNumber: 7, description: 'Vapour recovery hose is inerted, where needed', hasNotApplicable: false },
  { clNumber: 8, description: 'Vapour hose connection confirmed vapour tight', hasNotApplicable: false },
  { clNumber: 9, description: 'Ship pressure and vacuum relief settings in:', hasNotApplicable: false },
  { clNumber: 10, description: 'Type of vapours from current/previous cargoes', hasNotApplicable: false },
  { clNumber: 11, description: 'Are the vapours being balanced harmful to ship\'s crew? E.g. H2S', hasNotApplicable: false },
  { clNumber: 12, description: 'Maximum pressure differential at maximum transfer rate (mm WG or psi)', hasNotApplicable: false },
  { clNumber: 13, description: 'Cargo tank pressure range to be maintained (mm WG or psi)', hasNotApplicable: false },
  { clNumber: 14, description: 'Cargo tank pressure alarm set points', hasNotApplicable: false },
  { clNumber: 15, description: 'IG main pressure alarm set points:', hasNotApplicable: false },
  { clNumber: 16, description: 'Vapour emission control system pressure alarm set points:', hasNotApplicable: false },
  { clNumber: 17, description: 'Oxygen analyser has been checked and calibrated', hasNotApplicable: false },
  { clNumber: 18, description: 'Agreement on the transfer sequence and procedures:', hasNotApplicable: false },
];

// CL 4C Chemical Tankers
const CHECKLIST_4C = [
  { clNumber: 1, description: 'Inhibition certificate received (if required) from manufacturer', hasNotApplicable: false },
  { clNumber: 2, description: 'Countermeasures against personal contact with cargo are agreed', hasNotApplicable: false },
];

// CL 4D LPG/LNG
const CHECKLIST_4D = [
  { clNumber: 1, description: 'Inhibition certificate received (if required) from manufacturer', hasNotApplicable: false },
  { clNumber: 2, description: 'Maximum working pressures are agreed between ships', hasNotApplicable: false },
  { clNumber: 3, description: 'Cargo handling rate and relationship with valve closure times and automatic shutdown systems is agreed', hasNotApplicable: false },
  { clNumber: 4, description: 'Maximum/minimum temperatures/pressures of the cargo to be transferred are agreed', hasNotApplicable: false },
  { clNumber: 5, description: 'Cargo tank relief valve settings are confirmed', hasNotApplicable: false },
  { clNumber: 6, description: 'Cooldown procedures have been agreed', hasNotApplicable: false },
  { clNumber: 7, description: 'Procedures for increasing/reducing transfer rates have been agreed', hasNotApplicable: false },
  { clNumber: 8, description: 'The potential for cargo roll-over has been considered', hasNotApplicable: false },
  { clNumber: 9, description: 'The deck watch is aware of the location and activation method of ESD systems on deck', hasNotApplicable: false },
];

// CL 4E LNG
const CHECKLIST_4E_ITEMS = [
  { description: 'ESD warm test has been undertaken from both ships.', hasNotApplicable: false },
  { description: 'ERS release mechanism functional test only (with no coupling release) has been tested.', hasNotApplicable: false },
  { clNumber: 2, description: 'Cargo transfer lines have been purged with nitrogen to below 5%O2', hasNotApplicable: false },
  { clNumber: 3, description: 'Cargo transfer line connections are leak tested', hasNotApplicable: false },
  { clNumber: 4, description: 'The nitrogen plant will be operational throughout the transfer', hasNotApplicable: false },
  { clNumber: 5, description: 'The protective water curtain is running', hasNotApplicable: false },
];

export default function STSChecklist4AF() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // Trim trailing comma from operationRef if present
  const rawOperationRef = searchParams.get('operationRef');
  const operationRef = rawOperationRef ? rawOperationRef.replace(/,\s*$/, '').trim() : null;
  const mode = searchParams.get('mode'); // 'update' or null
  const signatureFileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    operationRef: operationRef || '',
    formNo: 'OPS-OFD-004',
    issueDate: new Date().toISOString().split('T')[0],
    approvedBy: 'JS',
    // Transfer Info
    constantHeadingShip: '',
    manoeuvringShip: '',
    designatedPOACName: '',
    stsSuperintendentName: '',
    transferDate: '',
    transferLocation: '',
    // CL 4A
    checklist4A: {
      checks: CHECKLIST_4A.map(item => ({
        clNumber: item.clNumber,
        description: item.description,
        status: { chs: false, ms: false, notApplicable: false, remarks: '' },
        hasNotApplicable: item.hasNotApplicable,
      })),
      simops: {
        nitrogenPurgingOrInerting: { chs: false, ms: false, notApplicable: false, remarks: '' },
        repairsMaintenance: { chs: false, ms: false, notApplicable: false, remarks: '' },
        tankCleaning: { chs: false, ms: false, notApplicable: false, remarks: '' },
        cow: { chs: false, ms: false, notApplicable: false, remarks: '' },
        slopsDischarge: { chs: false, ms: false, notApplicable: false, remarks: '' },
        wasteDischarge: { chs: false, ms: false, notApplicable: false, remarks: '' },
        bunkering: { chs: false, ms: false, notApplicable: false, remarks: '' },
        receivingStores: { chs: false, ms: false, notApplicable: false, remarks: '' },
        personnelTransfer: { chs: false, ms: false, notApplicable: false, remarks: '' },
        crewChange: { chs: false, ms: false, notApplicable: false, remarks: '' },
        plannedDrills: { chs: false, ms: false, notApplicable: false, remarks: '' },
      },
    },
    // CL 4B
    checklist4B: {
      checks: CHECKLIST_4B.map(item => ({
        clNumber: item.clNumber,
        description: item.description,
        status: { chs: false, ms: false, notApplicable: false, remarks: '' },
        hasNotApplicable: item.hasNotApplicable,
      })),
      pvDevices: {
        liquidPVBreaker: '',
        tankPVValves: '',
        mastHeadPVValves: '',
        otherPVDevices: '',
      },
      pressureSettings: {
        maxPressureDifferential: '',
        cargoTankPressureRange: '',
        cargoTankPressureAlarm: { high: '', low: '' },
        igMainPressureAlarm: { high: '', low: '' },
        vapourEmissionPressureAlarm: { high: '', low: '' },
      },
      oxygenAnalyserChecked: { chs: false, ms: false, notApplicable: false, remarks: '' },
      transferSequenceAgreement: {
        normalStartUp: false,
        normalShutdown: false,
        lowVapourPressureAlarm: false,
        highVapourPressureAlarm: false,
      },
    },
    // CL 4C
    checklist4C: CHECKLIST_4C.map(item => ({
      clNumber: item.clNumber,
      description: item.description,
      status: { chs: false, ms: false, notApplicable: false, remarks: '' },
      hasNotApplicable: item.hasNotApplicable,
    })),
    // CL 4D
    checklist4D: CHECKLIST_4D.map(item => ({
      clNumber: item.clNumber,
      description: item.description,
      status: { chs: false, ms: false, notApplicable: false, remarks: '' },
      hasNotApplicable: item.hasNotApplicable,
    })),
    // CL 4E
    checklist4E: {
      esdErsArrangementsTested: { chs: false, ms: false, notApplicable: false, remarks: '' },
      cargoLinesNitrogenPurged: { chs: false, ms: false, notApplicable: false, remarks: '' },
      connectionsLeakTested: { chs: false, ms: false, notApplicable: false, remarks: '' },
      nitrogenPlantOperational: { chs: false, ms: false, notApplicable: false, remarks: '' },
      waterCurtainRunning: { chs: false, ms: false, notApplicable: false, remarks: '' },
    },
    // CL 4F
    checklist4F: {
      jpo: { latestVersion: '', dateVersion: '' },
      workingLanguage: '',
      agreedSIMOPS: false,
      shipsReadyForManoeuvring: {
        notApplicableForHeadingShips: false,
        noticePeriod: '',
        ship1Minutes: '',
        ship2Minutes: '',
      },
      communicationSystem: { primarySystem: '', backupSystem: '' },
      operationalSupervision: {
        ship1Responsible: '',
        ship2Responsible: '',
        terminalResponsible: '',
      },
      smokingRestrictions: {
        ship1Restrictions: '',
        ship2Restrictions: '',
        terminalRestrictions: '',
      },
      stopCargoTransfer: '',
      environmentalLimits: {
        maxWindSpeed: '',
        current: '',
        swell: '',
        disconnect: '',
        unmooring: '',
      },
      cargoBallastLimits: {
        maxTransferRates: '',
        toppingOffRates: '',
        maxManifoldPressure: '',
        cargoTemperature: '',
        otherLimitations: '',
      },
      pressureSurgeControl: {
        loadingShip: '',
        minCargoTanksOpen: '',
        tankSwitchingProtocols: '',
        fullLoadRate: '',
        toppingOffRate: '',
        closingTimeAutoValves: '',
      },
      cargoTransferManagement: {
        actionNoticePeriods: '',
        transferStopProtocols: '',
      },
      routineChecks: {
        routineQuantityChecks: '',
      },
      emergencySignals: {
        ship1Signal: '',
        ship2Signal: '',
        terminalSignal: '',
      },
      tankSystem: {
        ship1System: '',
        ship2System: '',
      },
      closedOperations: {
        notApplicable: false,
        requirements: '',
      },
      esdOilChemical: {
        notApplicable: false,
        confirmSystem: '',
      },
      esdErsLpgLng: {
        notApplicable: false,
        fibreOpticLink: '',
        closingTimeUnloadingSeconds: '',
        closingTimeLoadingSeconds: '',
        ersAvailable: false,
      },
      vapourBalancingEmergency: {
        notApplicable: false,
        ventVesselIfNeeded: '',
      },
    },
    // Signature
    signature: {
      name: '',
      rank: '',
      signature: '',
      date: '',
    },
  });

  const handleTransferInfoChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleChecklist4AChange = (index, field, value) => {
    const updatedChecks = [...formData.checklist4A.checks];
    if (field === 'chs' || field === 'ms' || field === 'notApplicable') {
      updatedChecks[index].status[field] = value;
    } else if (field === 'remarks') {
      updatedChecks[index].status.remarks = value;
    }
    setFormData({
      ...formData,
      checklist4A: { ...formData.checklist4A, checks: updatedChecks },
    });
  };

  const handleSimopsChange = (simopsKey, field, value) => {
    setFormData({
      ...formData,
      checklist4A: {
        ...formData.checklist4A,
        simops: {
          ...formData.checklist4A.simops,
          [simopsKey]: {
            ...formData.checklist4A.simops[simopsKey],
            [field]: value,
          },
        },
      },
    });
  };

  const handleChecklist4BChange = (index, field, value) => {
    const updatedChecks = [...formData.checklist4B.checks];
    if (field === 'chs' || field === 'ms' || field === 'notApplicable') {
      updatedChecks[index].status[field] = value;
    } else if (field === 'remarks') {
      updatedChecks[index].status.remarks = value;
    }
    setFormData({
      ...formData,
      checklist4B: { ...formData.checklist4B, checks: updatedChecks },
    });
  };

  const handleChecklist4BFieldChange = (section, field, value, subField = null) => {
    if (subField) {
      setFormData({
        ...formData,
        checklist4B: {
          ...formData.checklist4B,
          [section]: {
            ...formData.checklist4B[section],
            [field]: {
              ...formData.checklist4B[section][field],
              [subField]: value,
            },
          },
        },
      });
    } else {
      setFormData({
        ...formData,
        checklist4B: {
          ...formData.checklist4B,
          [section]: {
            ...formData.checklist4B[section],
            [field]: value,
          },
        },
      });
    }
  };

  const handleChecklist4CChange = (index, field, value) => {
    const updatedChecks = [...formData.checklist4C];
    if (field === 'chs' || field === 'ms' || field === 'notApplicable') {
      updatedChecks[index].status[field] = value;
    } else if (field === 'remarks') {
      updatedChecks[index].status.remarks = value;
    }
    setFormData({ ...formData, checklist4C: updatedChecks });
  };

  const handleChecklist4DChange = (index, field, value) => {
    const updatedChecks = [...formData.checklist4D];
    if (field === 'chs' || field === 'ms' || field === 'notApplicable') {
      updatedChecks[index].status[field] = value;
    } else if (field === 'remarks') {
      updatedChecks[index].status.remarks = value;
    }
    setFormData({ ...formData, checklist4D: updatedChecks });
  };

  const handleChecklist4EChange = (field, subField, value) => {
    setFormData({
      ...formData,
      checklist4E: {
        ...formData.checklist4E,
        [field]: {
          ...formData.checklist4E[field],
          [subField]: value,
        },
      },
    });
  };

  const handleChecklist4FChange = (section, field, value, subField = null, subSubField = null) => {
    if (subSubField) {
      setFormData({
        ...formData,
        checklist4F: {
          ...formData.checklist4F,
          [section]: {
            ...formData.checklist4F[section],
            [field]: {
              ...formData.checklist4F[section][field],
              [subField]: {
                ...formData.checklist4F[section][field][subField],
                [subSubField]: value,
              },
            },
          },
        },
      });
    } else if (subField) {
      setFormData({
        ...formData,
        checklist4F: {
          ...formData.checklist4F,
          [section]: {
            ...formData.checklist4F[section],
            [field]: {
              ...formData.checklist4F[section][field],
              [subField]: value,
            },
          },
        },
      });
    } else if (field === null) {
      // Handle direct section assignment (for simple string fields like workingLanguage, stopCargoTransfer)
      setFormData({
        ...formData,
        checklist4F: {
          ...formData.checklist4F,
          [section]: value,
        },
      });
    } else {
      setFormData({
        ...formData,
        checklist4F: {
          ...formData.checklist4F,
          [section]: {
            ...formData.checklist4F[section],
            [field]: value,
          },
        },
      });
    }
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
    if (errorMessage.startsWith('SERVER_ERROR_')) {
      return 'Server error occurred. Please try again later or contact support.';
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
    if (errorLower.includes('404') || errorLower.includes('not found') || errorLower.includes('no checklist found')) {
      return 'Checklist not found. Please verify the operation reference number.';
    }
    
    // 500 errors
    if (errorLower.includes('500') || errorLower.includes('internal server error')) {
      return 'Server error occurred. Please try again later or contact support.';
    }
    
    // 502/503 errors
    if (errorLower.includes('502') || errorLower.includes('503') || errorLower.includes('bad gateway') || errorLower.includes('service unavailable')) {
      return 'Service temporarily unavailable. Please try again in a few moments.';
    }
    
    // Backend connection errors
    if (errorLower.includes('cannot reach') || errorLower.includes('oceane-marine') || errorLower.includes('backend')) {
      return 'Unable to connect to server. Please ensure the server is running.';
    }
    
    // JSON parsing errors
    if (errorLower.includes('json') || errorLower.includes('parse') || errorLower.includes('invalid response')) {
      return 'Invalid response from server. Please try again.';
    }
    
    // MongoDB/ObjectId errors
    if (errorLower.includes('cast to objectid') || errorLower.includes('objectid failed')) {
      return 'Invalid operation reference format. Please check the link and try again.';
    }
    
    // Validation errors - keep as is if they're short and clear
    if ((errorLower.includes('required') || errorLower.includes('invalid') || errorLower.includes('missing')) && errorMessage.length < 80) {
      return errorMessage;
    }
    
    // Generic fallback - return a simple message without technical details
    if (errorMessage.length > 100 || errorMessage.includes('http://') || errorMessage.includes('localhost') || errorMessage.includes('node_modules')) {
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
      formNo: 'OPS-OFD-004',
      issueDate: new Date().toISOString().split('T')[0],
      approvedBy: 'JS',
      constantHeadingShip: '',
      manoeuvringShip: '',
      designatedPOACName: '',
      stsSuperintendentName: '',
      transferDate: '',
      transferLocation: '',
      checklist4A: {
        checks: CHECKLIST_4A.map(item => ({
          clNumber: item.clNumber,
          description: item.description,
          status: { chs: false, ms: false, notApplicable: false, remarks: '' },
          hasNotApplicable: item.hasNotApplicable,
        })),
        simops: {
          nitrogenPurgingOrInerting: { chs: false, ms: false, notApplicable: false, remarks: '' },
          repairsMaintenance: { chs: false, ms: false, notApplicable: false, remarks: '' },
          tankCleaning: { chs: false, ms: false, notApplicable: false, remarks: '' },
          cow: { chs: false, ms: false, notApplicable: false, remarks: '' },
          slopsDischarge: { chs: false, ms: false, notApplicable: false, remarks: '' },
          wasteDischarge: { chs: false, ms: false, notApplicable: false, remarks: '' },
          bunkering: { chs: false, ms: false, notApplicable: false, remarks: '' },
          receivingStores: { chs: false, ms: false, notApplicable: false, remarks: '' },
          personnelTransfer: { chs: false, ms: false, notApplicable: false, remarks: '' },
          crewChange: { chs: false, ms: false, notApplicable: false, remarks: '' },
          plannedDrills: { chs: false, ms: false, notApplicable: false, remarks: '' },
        },
      },
      checklist4B: {
        checks: CHECKLIST_4B.map(item => ({
          clNumber: item.clNumber,
          description: item.description,
          status: { chs: false, ms: false, notApplicable: false, remarks: '' },
          hasNotApplicable: item.hasNotApplicable,
        })),
        pvDevices: {
          liquidPVBreaker: '',
          tankPVValves: '',
          mastHeadPVValves: '',
          otherPVDevices: '',
        },
        pressureSettings: {
          maxPressureDifferential: '',
          cargoTankPressureRange: '',
          cargoTankPressureAlarm: { high: '', low: '' },
          igMainPressureAlarm: { high: '', low: '' },
          vapourEmissionPressureAlarm: { high: '', low: '' },
        },
        oxygenAnalyserChecked: { chs: false, ms: false, notApplicable: false, remarks: '' },
        transferSequenceAgreement: {
          normalStartUp: false,
          normalShutdown: false,
          lowVapourPressureAlarm: false,
          highVapourPressureAlarm: false,
        },
      },
      checklist4C: CHECKLIST_4C.map(item => ({
        clNumber: item.clNumber,
        description: item.description,
        status: { chs: false, ms: false, notApplicable: false, remarks: '' },
        hasNotApplicable: item.hasNotApplicable,
      })),
      checklist4D: CHECKLIST_4D.map(item => ({
        clNumber: item.clNumber,
        description: item.description,
        status: { chs: false, ms: false, notApplicable: false, remarks: '' },
        hasNotApplicable: item.hasNotApplicable,
      })),
      checklist4E: {
        esdErsArrangementsTested: { chs: false, ms: false, notApplicable: false, remarks: '' },
        cargoLinesNitrogenPurged: { chs: false, ms: false, notApplicable: false, remarks: '' },
        connectionsLeakTested: { chs: false, ms: false, notApplicable: false, remarks: '' },
        nitrogenPlantOperational: { chs: false, ms: false, notApplicable: false, remarks: '' },
        waterCurtainRunning: { chs: false, ms: false, notApplicable: false, remarks: '' },
      },
      checklist4F: {
        jpo: { latestVersion: '', dateVersion: '' },
        workingLanguage: '',
        agreedSIMOPS: false,
        shipsReadyForManoeuvring: {
          notApplicableForHeadingShips: false,
          noticePeriod: '',
          ship1Minutes: '',
          ship2Minutes: '',
        },
        communicationSystem: { primarySystem: '', backupSystem: '' },
        operationalSupervision: {
          ship1Responsible: '',
          ship2Responsible: '',
          terminalResponsible: '',
        },
        smokingRestrictions: {
          ship1Restrictions: '',
          ship2Restrictions: '',
          terminalRestrictions: '',
        },
        stopCargoTransfer: '',
        environmentalLimits: {
          maxWindSpeed: '',
          current: '',
          swell: '',
          disconnect: '',
          unmooring: '',
        },
        cargoBallastLimits: {
          maxTransferRates: '',
          toppingOffRates: '',
          maxManifoldPressure: '',
          cargoTemperature: '',
          otherLimitations: '',
        },
        pressureSurgeControl: {
          loadingShip: '',
          minCargoTanksOpen: '',
          tankSwitchingProtocols: '',
          fullLoadRate: '',
          toppingOffRate: '',
          closingTimeAutoValves: '',
        },
        cargoTransferManagement: {
          actionNoticePeriods: '',
          transferStopProtocols: '',
        },
        routineChecks: {
          routineQuantityChecks: '',
        },
        emergencySignals: {
          ship1Signal: '',
          ship2Signal: '',
          terminalSignal: '',
        },
        tankSystem: {
          ship1System: '',
          ship2System: '',
        },
        closedOperations: {
          notApplicable: false,
          requirements: '',
        },
        esdOilChemical: {
          notApplicable: false,
          confirmSystem: '',
        },
        esdErsLpgLng: {
          notApplicable: false,
          fibreOpticLink: '',
          closingTimeUnloadingSeconds: '',
          closingTimeLoadingSeconds: '',
          ersAvailable: false,
        },
        vapourBalancingEmergency: {
          notApplicable: false,
          ventVesselIfNeeded: '',
        },
      },
      signature: {
        name: '',
        rank: '',
        signature: '',
        date: '',
      },
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
      formNo: 'OPS-OFD-004',
      issueDate: new Date().toISOString().split('T')[0],
      approvedBy: 'JS',
      constantHeadingShip: '',
      manoeuvringShip: '',
      designatedPOACName: '',
      stsSuperintendentName: '',
      transferDate: '',
      transferLocation: '',
      checklist4A: {
        checks: CHECKLIST_4A.map(item => ({
          clNumber: item.clNumber,
          description: item.description,
          status: { chs: false, ms: false, notApplicable: false, remarks: '' },
          hasNotApplicable: item.hasNotApplicable,
        })),
        simops: {
          nitrogenPurgingOrInerting: { chs: false, ms: false, notApplicable: false, remarks: '' },
          repairsMaintenance: { chs: false, ms: false, notApplicable: false, remarks: '' },
          tankCleaning: { chs: false, ms: false, notApplicable: false, remarks: '' },
          cow: { chs: false, ms: false, notApplicable: false, remarks: '' },
          slopsDischarge: { chs: false, ms: false, notApplicable: false, remarks: '' },
          wasteDischarge: { chs: false, ms: false, notApplicable: false, remarks: '' },
          bunkering: { chs: false, ms: false, notApplicable: false, remarks: '' },
          receivingStores: { chs: false, ms: false, notApplicable: false, remarks: '' },
          personnelTransfer: { chs: false, ms: false, notApplicable: false, remarks: '' },
          crewChange: { chs: false, ms: false, notApplicable: false, remarks: '' },
          plannedDrills: { chs: false, ms: false, notApplicable: false, remarks: '' },
        },
      },
      checklist4B: {
        checks: CHECKLIST_4B.map(item => ({
          clNumber: item.clNumber,
          description: item.description,
          status: { chs: false, ms: false, notApplicable: false, remarks: '' },
          hasNotApplicable: item.hasNotApplicable,
        })),
        pvDevices: {
          liquidPVBreaker: '',
          tankPVValves: '',
          mastHeadPVValves: '',
          otherPVDevices: '',
        },
        pressureSettings: {
          maxPressureDifferential: '',
          cargoTankPressureRange: '',
          cargoTankPressureAlarm: { high: '', low: '' },
          igMainPressureAlarm: { high: '', low: '' },
          vapourEmissionPressureAlarm: { high: '', low: '' },
        },
        oxygenAnalyserChecked: { chs: false, ms: false, notApplicable: false, remarks: '' },
        transferSequenceAgreement: {
          normalStartUp: false,
          normalShutdown: false,
          lowVapourPressureAlarm: false,
          highVapourPressureAlarm: false,
        },
      },
      checklist4C: CHECKLIST_4C.map(item => ({
        clNumber: item.clNumber,
        description: item.description,
        status: { chs: false, ms: false, notApplicable: false, remarks: '' },
        hasNotApplicable: item.hasNotApplicable,
      })),
      checklist4D: CHECKLIST_4D.map(item => ({
        clNumber: item.clNumber,
        description: item.description,
        status: { chs: false, ms: false, notApplicable: false, remarks: '' },
        hasNotApplicable: item.hasNotApplicable,
      })),
      checklist4E: {
        esdErsArrangementsTested: { chs: false, ms: false, notApplicable: false, remarks: '' },
        cargoLinesNitrogenPurged: { chs: false, ms: false, notApplicable: false, remarks: '' },
        connectionsLeakTested: { chs: false, ms: false, notApplicable: false, remarks: '' },
        nitrogenPlantOperational: { chs: false, ms: false, notApplicable: false, remarks: '' },
        waterCurtainRunning: { chs: false, ms: false, notApplicable: false, remarks: '' },
      },
      checklist4F: {
        jpo: { latestVersion: '', dateVersion: '' },
        workingLanguage: '',
        agreedSIMOPS: false,
        shipsReadyForManoeuvring: {
          notApplicableForHeadingShips: false,
          noticePeriod: '',
          ship1Minutes: '',
          ship2Minutes: '',
        },
        communicationSystem: { primarySystem: '', backupSystem: '' },
        operationalSupervision: {
          ship1Responsible: '',
          ship2Responsible: '',
          terminalResponsible: '',
        },
        smokingRestrictions: {
          ship1Restrictions: '',
          ship2Restrictions: '',
          terminalRestrictions: '',
        },
        stopCargoTransfer: '',
        environmentalLimits: {
          maxWindSpeed: '',
          current: '',
          swell: '',
          disconnect: '',
          unmooring: '',
        },
        cargoBallastLimits: {
          maxTransferRates: '',
          toppingOffRates: '',
          maxManifoldPressure: '',
          cargoTemperature: '',
          otherLimitations: '',
        },
        pressureSurgeControl: {
          loadingShip: '',
          minCargoTanksOpen: '',
          tankSwitchingProtocols: '',
          fullLoadRate: '',
          toppingOffRate: '',
          closingTimeAutoValves: '',
        },
        cargoTransferManagement: {
          actionNoticePeriods: '',
          transferStopProtocols: '',
        },
        routineChecks: {
          routineQuantityChecks: '',
        },
        emergencySignals: {
          ship1Signal: '',
          ship2Signal: '',
          terminalSignal: '',
        },
        tankSystem: {
          ship1System: '',
          ship2System: '',
        },
        closedOperations: {
          notApplicable: false,
          requirements: '',
        },
        esdOilChemical: {
          notApplicable: false,
          confirmSystem: '',
        },
        esdErsLpgLng: {
          notApplicable: false,
          fibreOpticLink: '',
          closingTimeUnloadingSeconds: '',
          closingTimeLoadingSeconds: '',
          ersAvailable: false,
        },
        vapourBalancingEmergency: {
          notApplicable: false,
          ventVesselIfNeeded: '',
        },
      },
      signature: {
        name: '',
        rank: '',
        signature: '',
        date: '',
      },
    });
    // Reset file input
    if (signatureFileInputRef.current) {
      signatureFileInputRef.current.value = '';
    }
    // Clear update mode
    setIsUpdateMode(false);
    // Clear URL parameters
    router.replace('/OPS-OFD-004');
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
      const res = await fetch(`/api/sts-proxy/ops-ofd-004?operationRef=${encodedRef}`);
      
      // Handle 404 specifically (data not found)
      if (res.status === 404) {
        throw new Error('CHECKLIST_NOT_FOUND');
      }
      
      // Parse response (read body only once)
      const contentType = res.headers.get("content-type");
      let responseData;
      
      try {
        if (contentType?.includes("application/json")) {
          responseData = await res.json();
        } else {
          const text = await res.text();
          // Try to parse as JSON
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
        const errorMsg = responseData?.error || responseData?.message || `SERVER_ERROR_${res.status}`;
        throw new Error(errorMsg);
      }
      
      // Populate form with fetched data
      // Handle both response.data and direct response
      const data = responseData?.data || responseData;
      
      if (!data) {
        throw new Error('NO_DATA_RECEIVED');
      }
      
      // Clean operationRef from data (remove trailing comma if present)
      const cleanOperationRef = (data.operationRef || trimmedRef || '')?.replace(/,\s*$/, '').trim();
      
      setFormData({
        operationRef: cleanOperationRef || '',
        formNo: (data.documentInfo?.formNo || data.formNo || 'OPS-OFD-004')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-004',
        issueDate: safeParseDate(data.documentInfo?.revisionDate || data.revisionDate || data.issueDate) || new Date().toISOString().split('T')[0],
        approvedBy: data.documentInfo?.approvedBy || data.approvedBy || 'JS',
        constantHeadingShip: data.transferInfo?.constantHeadingShip || '',
        manoeuvringShip: data.transferInfo?.manoeuvringShip || '',
        designatedPOACName: data.transferInfo?.designatedPOACName || '',
        stsSuperintendentName: data.transferInfo?.stsSuperintendentName || '',
        transferDate: safeParseDate(data.transferInfo?.transferDate) || '',
        transferLocation: data.transferInfo?.transferLocation || '',
        checklist4A: data.checklist4A || formData.checklist4A,
        checklist4B: data.checklist4B || formData.checklist4B,
        checklist4C: data.checklist4C || formData.checklist4C,
        checklist4D: data.checklist4D || formData.checklist4D,
        checklist4E: data.checklist4E || formData.checklist4E,
        checklist4F: data.checklist4F || formData.checklist4F,
        signature: {
          name: data.signature?.name || '',
          rank: data.signature?.rank || '',
          signature: getSignatureUrl(data.signature?.signature || ''),
          date: safeParseDate(data.signature?.date) || '',
        },
      });
    } catch (err) {
      // Convert technical error to user-friendly message
      const userFriendlyError = getUserFriendlyError(err);
      setSubmitError(userFriendlyError);
      // Log technical details to console for debugging (not shown to user)
      console.error('Error fetching checklist data:', err);
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

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [isUpdateMode, setIsUpdateMode] = useState(false);

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
          formNo: (formData.formNo || 'OPS-OFD-004')?.replace(/,\s*$/, '').trim() || 'OPS-OFD-004',
          revisionNo: formData.revisionNo || '',
          revisionDate: formData.issueDate || null,
          approvedBy: formData.approvedBy,
          page: '',
        },
        transferInfo: {
          constantHeadingShip: formData.constantHeadingShip || '',
          manoeuvringShip: formData.manoeuvringShip || '',
          designatedPOACName: formData.designatedPOACName || '',
          stsSuperintendentName: formData.stsSuperintendentName || '',
          transferDate: formData.transferDate || null,
          transferLocation: formData.transferLocation || '',
        },
        checklist4A: formData.checklist4A,
        checklist4B: formData.checklist4B,
        checklist4C: formData.checklist4C,
        checklist4D: formData.checklist4D,
        checklist4E: formData.checklist4E,
        checklist4F: formData.checklist4F,
        signature: {
          name: formData.signature.name || '',
          rank: formData.signature.rank || '',
          date: formData.signature.date || null,
          signature: extractBase64(formData.signature.signature || ''),
        },
        signatureBlock: {
          signature: extractBase64(formData.signature.signature || ''),
        },
        status: 'DRAFT',
      };

      const form = new FormData();
      form.append("data", JSON.stringify(payload));

      // Use PUT for update mode, POST for create mode
      const method = isUpdateMode ? "PUT" : "POST";
      const encodedRef = encodeURIComponent(cleanOperationRef);
      const url = isUpdateMode 
        ? `/api/sts-proxy/ops-ofd-004?operationRef=${encodedRef}`
        : "/api/sts-proxy/ops-ofd-004/create";

      let res;
      try {
        res = await fetch(url, {
          method: method,
          body: form
        });
      } catch (fetchError) {
        // Handle network errors
        if (fetchError.name === 'TypeError' && fetchError.message.includes('fetch')) {
          throw new Error('Network error: Unable to connect to server. Please check your connection.');
        }
        throw fetchError;
      }

      // Parse response (handle both success and error cases)
      const contentType = res.headers.get("content-type");
      let responseData;
      
      try {
        if (contentType?.includes("application/json")) {
          responseData = await res.json();
        } else {
          const text = await res.text();
          // Try to parse as JSON if it looks like JSON
          try {
            responseData = JSON.parse(text);
          } catch {
            // If not JSON, use the text as error message
            throw new Error(text || `Server error: ${res.status} ${res.statusText}`);
          }
        }
      } catch (parseError) {
        // If we can't parse, use the parse error or status
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
      // Log technical details to console for debugging (not shown to user)
      console.error('Error submitting checklist:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const renderDualStatusChecklist = (checklist, checklistType, onChangeHandler) => {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-600">
          <thead>
            <tr className="bg-gray-700">
              <th className="border border-gray-600 p-3 text-center w-16">CL</th>
              <th className="border border-gray-600 p-3 text-left">Generic Checks</th>
              <th className="border border-gray-600 p-3 text-center w-24">CHS Status</th>
              <th className="border border-gray-600 p-3 text-center w-24">MS Status</th>
              <th className="border border-gray-600 p-3 text-left">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {checklist.map((item, index) => (
              <tr key={item.clNumber || index} className="hover:bg-gray-700">
                <td className="border border-gray-600 p-3 text-center font-semibold">
                  {item.clNumber || ''}
                </td>
                <td className="border border-gray-600 p-3 text-sm">
                  {item.description}
                </td>
                <td className="border border-gray-600 p-3 text-center">
                  <label className="flex items-center justify-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.status?.chs || false}
                      onChange={(e) => onChangeHandler(index, 'chs', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Yes</span>
                  </label>
                </td>
                <td className="border border-gray-600 p-3 text-center">
                  <label className="flex items-center justify-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.status?.ms || false}
                      onChange={(e) => onChangeHandler(index, 'ms', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Yes</span>
                  </label>
                </td>
                <td className="border border-gray-600 p-3">
                  <input
                    type="text"
                    value={item.status?.remarks || ''}
                    onChange={(e) => onChangeHandler(index, 'remarks', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                    placeholder="Add remarks..."
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
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
              AT SEA SHIP TO SHIP TRANSFER
            </h1>
            <h2 className="text-base sm:text-lg lg:text-xl font-semibold">
              CHECKLIST 4A-F - PRE TRANSFER CONFERENCE
            </h2>
            {isUpdateMode && (
              <div className="mt-2 px-3 sm:px-4 py-1 bg-yellow-600/30 border border-yellow-500 rounded text-yellow-300 text-xs sm:text-sm font-semibold">
                EDIT MODE
              </div>
            )}
          </div>
          <div className="bg-gray-700 p-3 sm:p-4 rounded w-full lg:w-auto lg:min-w-[200px]">
            <div className="text-xs sm:text-sm space-y-1">
              <div><strong>Form No:</strong> {formData.formNo}</div>
              <div><strong>Issue Date:</strong> {formData.issueDate}</div>
              <div><strong>Approved by:</strong> {formData.approvedBy}</div>
              <div><strong>Operation Ref:</strong> {formData.operationRef || '—'}</div>
            </div>
          </div>
        </div>

        {/* Transfer Info Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Transfer Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Constant Heading Ship:</label>
              <input
                type="text"
                value={formData.constantHeadingShip}
                onChange={(e) => handleTransferInfoChange('constantHeadingShip', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Maneuvering Ship:</label>
              <input
                type="text"
                value={formData.manoeuvringShip}
                onChange={(e) => handleTransferInfoChange('manoeuvringShip', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Name of Designated POAC:</label>
              <input
                type="text"
                value={formData.designatedPOACName}
                onChange={(e) => handleTransferInfoChange('designatedPOACName', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Name of STS Superintendent if Different from POAC:</label>
              <input
                type="text"
                value={formData.stsSuperintendentName}
                onChange={(e) => handleTransferInfoChange('stsSuperintendentName', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Date of Transfer:</label>
              <input
                type="date"
                value={formData.transferDate}
                onChange={(e) => handleTransferInfoChange('transferDate', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-sm mb-1">Location of Transfer:</label>
              <input
                type="text"
                value={formData.transferLocation}
                onChange={(e) => handleTransferInfoChange('transferLocation', e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
          </div>
        </div>

        {/* CL 4A Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">CL 4A - Generic Checks</h3>
          <p className="text-sm mb-4 italic text-gray-400">For discharging / receiving ship answer as appropriate</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-600">
              <thead>
                <tr className="bg-gray-700">
                  <th className="border border-gray-600 p-3 text-center w-16">CL 4A</th>
                  <th className="border border-gray-600 p-3 text-left">Generic Checks</th>
                  <th className="border border-gray-600 p-3 text-center w-24">CHS<br/>Status</th>
                  <th className="border border-gray-600 p-3 text-center w-24">MS<br/>Status</th>
                  <th className="border border-gray-600 p-3 text-left w-36">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {formData.checklist4A.checks.map((item, index) => {
                  const simopsKeyMap = {
                    'Nitrogen purging or inerting': 'nitrogenPurgingOrInerting',
                    'Repairs/maintenance': 'repairsMaintenance',
                    'Tank cleaning': 'tankCleaning',
                    'COW': 'cow',
                    'Slops discharge': 'slopsDischarge',
                    'Waste discharge': 'wasteDischarge',
                    'Bunkering': 'bunkering',
                    'Receiving stores': 'receivingStores',
                    'Personnel transfer': 'personnelTransfer',
                    'Crew change': 'crewChange',
                    'Planned drills': 'plannedDrills',
                  };
                  return (
                    <Fragment key={`4a-${item.clNumber}`}>
                      <tr className="hover:bg-gray-700">
                        <td className="border border-gray-600 p-3 text-center font-semibold">{item.clNumber}</td>
                        <td className="border border-gray-600 p-3 text-sm">{item.description}</td>
                        <td className="border border-gray-600 p-3 text-center">
                          <label className="flex items-center justify-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={item.status?.chs || false} onChange={(e) => handleChecklist4AChange(index, 'chs', e.target.checked)} className="w-4 h-4" />
                            <span className="text-sm">Yes</span>
                          </label>
                        </td>
                        <td className="border border-gray-600 p-3 text-center">
                          <label className="flex items-center justify-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={item.status?.ms || false} onChange={(e) => handleChecklist4AChange(index, 'ms', e.target.checked)} className="w-4 h-4" />
                            <span className="text-sm">Yes</span>
                          </label>
                        </td>
                        <td className="border border-gray-600 p-3">
                          <input type="text" value={item.status?.remarks || ''} onChange={(e) => handleChecklist4AChange(index, 'remarks', e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" placeholder="" />
                        </td>
                      </tr>
                      {/* SIMOPS sub-items inline after item 16 */}
                      {item.clNumber === 16 && SIMOPS_ITEMS.map((simopsItem, si) => {
                        const actualKey = simopsKeyMap[simopsItem];
                        const simopsData = formData.checklist4A.simops[actualKey];
                        return (
                          <tr key={`simops-${si}`} className="hover:bg-gray-700/50">
                            <td className="border border-gray-600 p-3 text-center"></td>
                            <td className="border border-gray-600 p-3 text-sm pl-8">- {simopsItem}</td>
                            <td className="border border-gray-600 p-3 text-center">
                              <label className="flex items-center justify-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={simopsData?.chs || false} onChange={(e) => handleSimopsChange(actualKey, 'chs', e.target.checked)} className="w-4 h-4" />
                                <span className="text-sm">Yes</span>
                              </label>
                            </td>
                            <td className="border border-gray-600 p-3 text-center">
                              <label className="flex items-center justify-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={simopsData?.ms || false} onChange={(e) => handleSimopsChange(actualKey, 'ms', e.target.checked)} className="w-4 h-4" />
                                <span className="text-sm">Yes</span>
                              </label>
                            </td>
                            <td className="border border-gray-600 p-3">
                              <input type="text" value={simopsData?.remarks || ''} onChange={(e) => handleSimopsChange(actualKey, 'remarks', e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" placeholder="" />
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* CL 4B Section - Additional for Vapor Balancing */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">CL 4B - Additional for Vapor Balancing</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-600">
              <thead>
                <tr className="bg-gray-700">
                  <th className="border border-gray-600 p-3 text-center w-16">CL 4B</th>
                  <th className="border border-gray-600 p-3 text-left">Additional for Vapor Balancing</th>
                  <th className="border border-gray-600 p-3 text-center w-24">CHS<br/>Status</th>
                  <th className="border border-gray-600 p-3 text-center w-24">MS Status</th>
                  <th className="border border-gray-600 p-3 text-left w-36">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {formData.checklist4B.checks.map((item, index) => {
                  return (
                    <Fragment key={`4b-${item.clNumber}`}>
                      {/* Main checklist row */}
                      <tr className="hover:bg-gray-700">
                        <td className="border border-gray-600 p-3 text-center font-semibold">{item.clNumber}</td>
                        <td className="border border-gray-600 p-3 text-sm">{item.description}</td>
                        <td className="border border-gray-600 p-3 text-center">
                          <label className="flex items-center justify-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={item.status?.chs || false} onChange={(e) => handleChecklist4BChange(index, 'chs', e.target.checked)} className="w-4 h-4" />
                            <span className="text-sm">Yes</span>
                          </label>
                        </td>
                        <td className="border border-gray-600 p-3 text-center">
                          <label className="flex items-center justify-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={item.status?.ms || false} onChange={(e) => handleChecklist4BChange(index, 'ms', e.target.checked)} className="w-4 h-4" />
                            <span className="text-sm">Yes</span>
                          </label>
                        </td>
                        <td className="border border-gray-600 p-3">
                          <input type="text" value={item.status?.remarks || ''} onChange={(e) => handleChecklist4BChange(index, 'remarks', e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                        </td>
                      </tr>

                      {/* Sub-rows after item 9: P/V Devices */}
                      {item.clNumber === 9 && (
                        <>
                          <tr className="hover:bg-gray-700/50">
                            <td className="border border-gray-600 p-3"></td>
                            <td className="border border-gray-600 p-3 text-sm pl-8">Liquid P/V breaker</td>
                            <td colSpan={3} className="border border-gray-600 p-3">
                              <input type="text" value={formData.checklist4B.pvDevices.liquidPVBreaker} onChange={(e) => handleChecklist4BFieldChange('pvDevices', 'liquidPVBreaker', e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                            </td>
                          </tr>
                          <tr className="hover:bg-gray-700/50">
                            <td className="border border-gray-600 p-3"></td>
                            <td className="border border-gray-600 p-3 text-sm pl-8">Tank P/V valves</td>
                            <td colSpan={3} className="border border-gray-600 p-3">
                              <input type="text" value={formData.checklist4B.pvDevices.tankPVValves} onChange={(e) => handleChecklist4BFieldChange('pvDevices', 'tankPVValves', e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                            </td>
                          </tr>
                          <tr className="hover:bg-gray-700/50">
                            <td className="border border-gray-600 p-3"></td>
                            <td className="border border-gray-600 p-3 text-sm pl-8">Mast head P/V valve(s)</td>
                            <td colSpan={3} className="border border-gray-600 p-3">
                              <input type="text" value={formData.checklist4B.pvDevices.mastHeadPVValves} onChange={(e) => handleChecklist4BFieldChange('pvDevices', 'mastHeadPVValves', e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                            </td>
                          </tr>
                          <tr className="hover:bg-gray-700/50">
                            <td className="border border-gray-600 p-3"></td>
                            <td className="border border-gray-600 p-3 text-sm pl-8">Other P/V relieving devices</td>
                            <td colSpan={3} className="border border-gray-600 p-3">
                              <input type="text" value={formData.checklist4B.pvDevices.otherPVDevices} onChange={(e) => handleChecklist4BFieldChange('pvDevices', 'otherPVDevices', e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                            </td>
                          </tr>
                        </>
                      )}

                      {/* Sub-rows after item 14: Cargo tank pressure alarm set points */}
                      {item.clNumber === 14 && (
                        <>
                          <tr className="hover:bg-gray-700/50">
                            <td className="border border-gray-600 p-3"></td>
                            <td className="border border-gray-600 p-3 text-sm pl-8">High alarm (mm WG or psi)</td>
                            <td colSpan={3} className="border border-gray-600 p-3">
                              <input type="text" value={formData.checklist4B.pressureSettings.cargoTankPressureAlarm.high} onChange={(e) => handleChecklist4BFieldChange('pressureSettings', 'cargoTankPressureAlarm', e.target.value, 'high')} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                            </td>
                          </tr>
                          <tr className="hover:bg-gray-700/50">
                            <td className="border border-gray-600 p-3"></td>
                            <td className="border border-gray-600 p-3 text-sm pl-8">Low alarm (mm WG or psi)</td>
                            <td colSpan={3} className="border border-gray-600 p-3">
                              <input type="text" value={formData.checklist4B.pressureSettings.cargoTankPressureAlarm.low} onChange={(e) => handleChecklist4BFieldChange('pressureSettings', 'cargoTankPressureAlarm', e.target.value, 'low')} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                            </td>
                          </tr>
                        </>
                      )}

                      {/* Sub-rows after item 15: IG main pressure alarm set points */}
                      {item.clNumber === 15 && (
                        <>
                          <tr className="hover:bg-gray-700/50">
                            <td className="border border-gray-600 p-3"></td>
                            <td className="border border-gray-600 p-3 text-sm pl-8">High alarm (mm WG or psi)</td>
                            <td colSpan={3} className="border border-gray-600 p-3">
                              <input type="text" value={formData.checklist4B.pressureSettings.igMainPressureAlarm.high} onChange={(e) => handleChecklist4BFieldChange('pressureSettings', 'igMainPressureAlarm', e.target.value, 'high')} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                            </td>
                          </tr>
                          <tr className="hover:bg-gray-700/50">
                            <td className="border border-gray-600 p-3"></td>
                            <td className="border border-gray-600 p-3 text-sm pl-8">Low alarm (mm WG or psi)</td>
                            <td colSpan={3} className="border border-gray-600 p-3">
                              <input type="text" value={formData.checklist4B.pressureSettings.igMainPressureAlarm.low} onChange={(e) => handleChecklist4BFieldChange('pressureSettings', 'igMainPressureAlarm', e.target.value, 'low')} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                            </td>
                          </tr>
                        </>
                      )}

                      {/* Sub-rows after item 16: Vapour emission control system */}
                      {item.clNumber === 16 && (
                        <>
                          <tr className="hover:bg-gray-700/50">
                            <td className="border border-gray-600 p-3"></td>
                            <td className="border border-gray-600 p-3 text-sm pl-8">High alarm (mm WG or psi)</td>
                            <td colSpan={3} className="border border-gray-600 p-3">
                              <input type="text" value={formData.checklist4B.pressureSettings.vapourEmissionPressureAlarm.high} onChange={(e) => handleChecklist4BFieldChange('pressureSettings', 'vapourEmissionPressureAlarm', e.target.value, 'high')} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                            </td>
                          </tr>
                          <tr className="hover:bg-gray-700/50">
                            <td className="border border-gray-600 p-3"></td>
                            <td className="border border-gray-600 p-3 text-sm pl-8">Low alarm (mm WG or psi)</td>
                            <td colSpan={3} className="border border-gray-600 p-3">
                              <input type="text" value={formData.checklist4B.pressureSettings.vapourEmissionPressureAlarm.low} onChange={(e) => handleChecklist4BFieldChange('pressureSettings', 'vapourEmissionPressureAlarm', e.target.value, 'low')} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                            </td>
                          </tr>
                        </>
                      )}

                      {/* Sub-rows after item 17: Oxygen analyser (already has CHS/MS in main row, but add dedicated controls) */}
                      {item.clNumber === 17 && (
                        <tr className="hover:bg-gray-700/50">
                          <td className="border border-gray-600 p-3"></td>
                          <td colSpan={4} className="border border-gray-600 p-3">
                            <div className="flex gap-6">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={formData.checklist4B.oxygenAnalyserChecked.chs} onChange={(e) => handleChecklist4BFieldChange('oxygenAnalyserChecked', 'chs', e.target.checked)} className="w-4 h-4" />
                                <span className="text-sm">CHS Confirmed</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={formData.checklist4B.oxygenAnalyserChecked.ms} onChange={(e) => handleChecklist4BFieldChange('oxygenAnalyserChecked', 'ms', e.target.checked)} className="w-4 h-4" />
                                <span className="text-sm">MS Confirmed</span>
                              </label>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Sub-rows after item 18: Transfer sequence agreement */}
                      {item.clNumber === 18 && (
                          <tr className="hover:bg-gray-700/50">
                            <td className="border border-gray-600 p-3"></td>
                            <td colSpan={4} className="border border-gray-600 p-3">
                              <div className="space-y-2 pl-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" checked={formData.checklist4B.transferSequenceAgreement.normalStartUp} onChange={(e) => handleChecklist4BFieldChange('transferSequenceAgreement', 'normalStartUp', e.target.checked)} className="w-4 h-4" />
                                  <span className="text-sm">Normal start up.</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" checked={formData.checklist4B.transferSequenceAgreement.normalShutdown} onChange={(e) => handleChecklist4BFieldChange('transferSequenceAgreement', 'normalShutdown', e.target.checked)} className="w-4 h-4" />
                                  <span className="text-sm">Normal shutdown.</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" checked={formData.checklist4B.transferSequenceAgreement.lowVapourPressureAlarm} onChange={(e) => handleChecklist4BFieldChange('transferSequenceAgreement', 'lowVapourPressureAlarm', e.target.checked)} className="w-4 h-4" />
                                  <span className="text-sm">Low vapour pressure alarm.</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" checked={formData.checklist4B.transferSequenceAgreement.highVapourPressureAlarm} onChange={(e) => handleChecklist4BFieldChange('transferSequenceAgreement', 'highVapourPressureAlarm', e.target.checked)} className="w-4 h-4" />
                                  <span className="text-sm">High vapour pressure alarm.</span>
                                </label>
                              </div>
                            </td>
                          </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* CL 4C Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">CL 4C - Additional for Chemical tankers</h3>
          {renderDualStatusChecklist(formData.checklist4C, '4C', handleChecklist4CChange)}
        </div>

        {/* CL 4D Section */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">CL 4D - Additional for LPG and LNG transfer</h3>
          {renderDualStatusChecklist(formData.checklist4D, '4D', handleChecklist4DChange)}
        </div>

        {/* CL 4E Section - Additional for LNG transfer */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">CL 4E - Additional for LNG transfer</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-600">
              <thead>
                <tr className="bg-gray-700">
                  <th className="border border-gray-600 p-3 text-center w-16">CL 4E</th>
                  <th className="border border-gray-600 p-3 text-left">Additional for LNG transfer</th>
                  <th className="border border-gray-600 p-3 text-center w-24">CHS<br/>Status</th>
                  <th className="border border-gray-600 p-3 text-center w-24">MS<br/>Status</th>
                  <th className="border border-gray-600 p-3 text-left w-36">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {/* Item 1: ESD and ERS system arrangements */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold">1</td>
                  <td className="border border-gray-600 p-3 text-sm">ESD and ERS system arrangements are in place and tested:</td>
                  <td className="border border-gray-600 p-3 text-center">
                    <label className="flex items-center justify-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.checklist4E.esdErsArrangementsTested.chs} onChange={(e) => handleChecklist4EChange('esdErsArrangementsTested', 'chs', e.target.checked)} className="w-4 h-4" />
                      <span className="text-sm">Yes</span>
                    </label>
                  </td>
                  <td className="border border-gray-600 p-3 text-center">
                    <label className="flex items-center justify-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.checklist4E.esdErsArrangementsTested.ms} onChange={(e) => handleChecklist4EChange('esdErsArrangementsTested', 'ms', e.target.checked)} className="w-4 h-4" />
                      <span className="text-sm">Yes</span>
                    </label>
                  </td>
                  <td className="border border-gray-600 p-3">
                    <input type="text" value={formData.checklist4E.esdErsArrangementsTested.remarks || ''} onChange={(e) => handleChecklist4EChange('esdErsArrangementsTested', 'remarks', e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" placeholder="" />
                  </td>
                </tr>
                {/* Sub-item: ESD warm test */}
                <tr className="hover:bg-gray-700/50">
                  <td className="border border-gray-600 p-3"></td>
                  <td className="border border-gray-600 p-3 text-sm pl-8">ESD warm test has been undertaken from both ships.</td>
                  <td className="border border-gray-600 p-3"></td>
                  <td className="border border-gray-600 p-3"></td>
                  <td className="border border-gray-600 p-3"></td>
                </tr>
                {/* Sub-item: ERS release mechanism */}
                <tr className="hover:bg-gray-700/50">
                  <td className="border border-gray-600 p-3"></td>
                  <td className="border border-gray-600 p-3 text-sm pl-8">ERS release mechanism functional test only (with no coupling release) has been tested.</td>
                  <td className="border border-gray-600 p-3"></td>
                  <td className="border border-gray-600 p-3"></td>
                  <td className="border border-gray-600 p-3"></td>
                </tr>
                {/* Item 2 */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold">2</td>
                  <td className="border border-gray-600 p-3 text-sm">Cargo transfer lines have been purged with nitrogen to below 5%O2</td>
                  <td className="border border-gray-600 p-3 text-center">
                    <label className="flex items-center justify-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.checklist4E.cargoLinesNitrogenPurged.chs} onChange={(e) => handleChecklist4EChange('cargoLinesNitrogenPurged', 'chs', e.target.checked)} className="w-4 h-4" />
                      <span className="text-sm">Yes</span>
                    </label>
                  </td>
                  <td className="border border-gray-600 p-3 text-center">
                    <label className="flex items-center justify-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.checklist4E.cargoLinesNitrogenPurged.ms} onChange={(e) => handleChecklist4EChange('cargoLinesNitrogenPurged', 'ms', e.target.checked)} className="w-4 h-4" />
                      <span className="text-sm">Yes</span>
                    </label>
                  </td>
                  <td className="border border-gray-600 p-3">
                    <input type="text" value={formData.checklist4E.cargoLinesNitrogenPurged.remarks || ''} onChange={(e) => handleChecklist4EChange('cargoLinesNitrogenPurged', 'remarks', e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" placeholder="" />
                  </td>
                </tr>
                {/* Item 3 */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold">3</td>
                  <td className="border border-gray-600 p-3 text-sm">Cargo transfer line connections are leak tested</td>
                  <td className="border border-gray-600 p-3 text-center">
                    <label className="flex items-center justify-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.checklist4E.connectionsLeakTested.chs} onChange={(e) => handleChecklist4EChange('connectionsLeakTested', 'chs', e.target.checked)} className="w-4 h-4" />
                      <span className="text-sm">Yes</span>
                    </label>
                  </td>
                  <td className="border border-gray-600 p-3 text-center">
                    <label className="flex items-center justify-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.checklist4E.connectionsLeakTested.ms} onChange={(e) => handleChecklist4EChange('connectionsLeakTested', 'ms', e.target.checked)} className="w-4 h-4" />
                      <span className="text-sm">Yes</span>
                    </label>
                  </td>
                  <td className="border border-gray-600 p-3">
                    <input type="text" value={formData.checklist4E.connectionsLeakTested.remarks || ''} onChange={(e) => handleChecklist4EChange('connectionsLeakTested', 'remarks', e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" placeholder="" />
                  </td>
                </tr>
                {/* Item 4 */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold">4</td>
                  <td className="border border-gray-600 p-3 text-sm">The nitrogen plant will be operational throughout the transfer</td>
                  <td className="border border-gray-600 p-3 text-center">
                    <label className="flex items-center justify-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.checklist4E.nitrogenPlantOperational.chs} onChange={(e) => handleChecklist4EChange('nitrogenPlantOperational', 'chs', e.target.checked)} className="w-4 h-4" />
                      <span className="text-sm">Yes</span>
                    </label>
                  </td>
                  <td className="border border-gray-600 p-3 text-center">
                    <label className="flex items-center justify-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.checklist4E.nitrogenPlantOperational.ms} onChange={(e) => handleChecklist4EChange('nitrogenPlantOperational', 'ms', e.target.checked)} className="w-4 h-4" />
                      <span className="text-sm">Yes</span>
                    </label>
                  </td>
                  <td className="border border-gray-600 p-3">
                    <input type="text" value={formData.checklist4E.nitrogenPlantOperational.remarks || ''} onChange={(e) => handleChecklist4EChange('nitrogenPlantOperational', 'remarks', e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" placeholder="" />
                  </td>
                </tr>
                {/* Item 5 */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold">5</td>
                  <td className="border border-gray-600 p-3 text-sm">The protective water curtain is running</td>
                  <td className="border border-gray-600 p-3 text-center">
                    <label className="flex items-center justify-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.checklist4E.waterCurtainRunning.chs} onChange={(e) => handleChecklist4EChange('waterCurtainRunning', 'chs', e.target.checked)} className="w-4 h-4" />
                      <span className="text-sm">Yes</span>
                    </label>
                  </td>
                  <td className="border border-gray-600 p-3 text-center">
                    <label className="flex items-center justify-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.checklist4E.waterCurtainRunning.ms} onChange={(e) => handleChecklist4EChange('waterCurtainRunning', 'ms', e.target.checked)} className="w-4 h-4" />
                      <span className="text-sm">Yes</span>
                    </label>
                  </td>
                  <td className="border border-gray-600 p-3">
                    <input type="text" value={formData.checklist4E.waterCurtainRunning.remarks || ''} onChange={(e) => handleChecklist4EChange('waterCurtainRunning', 'remarks', e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" placeholder="" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* CL 4F Section - Pretransfer Agreements */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">CL 4F - Pretransfer Agreements</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-600">
              <thead>
                <tr className="bg-gray-700">
                  <th className="border border-gray-600 p-3 text-center w-16">S. No</th>
                  <th className="border border-gray-600 p-3 text-left w-2/5">Description</th>
                  <th className="border border-gray-600 p-3 text-left">Agreement</th>
                </tr>
              </thead>
              <tbody>
                {/* 1. Latest version of the JPO */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold">1</td>
                  <td className="border border-gray-600 p-3 text-sm">Latest version of the JPO</td>
                  <td className="border border-gray-600 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm whitespace-nowrap">Date/version JPO:</span>
                      <input type="text" value={formData.checklist4F.jpo.dateVersion} onChange={(e) => handleChecklist4FChange('jpo', 'dateVersion', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                    </div>
                  </td>
                </tr>
                {/* 2. Working language */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold">2</td>
                  <td className="border border-gray-600 p-3 text-sm">Working language</td>
                  <td className="border border-gray-600 p-3">
                    <input type="text" value={formData.checklist4F.workingLanguage} onChange={(e) => handleChecklist4FChange('workingLanguage', null, e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                  </td>
                </tr>
                {/* 3. Agreed SIMOPS */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold">3</td>
                  <td className="border border-gray-600 p-3 text-sm">Agreed SIMOPS</td>
                  <td className="border border-gray-600 p-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.checklist4F.agreedSIMOPS} onChange={(e) => handleChecklist4FChange('agreedSIMOPS', null, e.target.checked)} className="w-4 h-4" />
                      <span className="text-sm">Not applicable for heading ships</span>
                    </label>
                  </td>
                </tr>
                {/* 4. Ships ready for maneuvering */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold align-top">4</td>
                  <td className="border border-gray-600 p-3 text-sm align-top">Ships ready for maneuvering</td>
                  <td className="border border-gray-600 p-3">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={formData.checklist4F.shipsReadyForManoeuvring.notApplicableForHeadingShips} onChange={(e) => handleChecklist4FChange('shipsReadyForManoeuvring', 'notApplicableForHeadingShips', e.target.checked)} className="w-4 h-4" />
                        <span className="text-sm">Not applicable for heading ships</span>
                      </label>
                      <p className="text-sm text-gray-400">Notice period (maximum for full readiness to maneuver):</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Ship 1:</span>
                        <input type="text" value={formData.checklist4F.shipsReadyForManoeuvring.ship1Minutes} onChange={(e) => handleChecklist4FChange('shipsReadyForManoeuvring', 'ship1Minutes', e.target.value)} className="w-24 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" placeholder="____" />
                        <span className="text-sm">min.</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Ship 2:</span>
                        <input type="text" value={formData.checklist4F.shipsReadyForManoeuvring.ship2Minutes} onChange={(e) => handleChecklist4FChange('shipsReadyForManoeuvring', 'ship2Minutes', e.target.value)} className="w-24 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" placeholder="____" />
                        <span className="text-sm">min.</span>
                      </div>
                    </div>
                  </td>
                </tr>
                {/* 5. Communication system */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold align-top">5</td>
                  <td className="border border-gray-600 p-3 text-sm align-top">Agreed communication system and backup arrangement</td>
                  <td className="border border-gray-600 p-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Primary system:</span>
                        <input type="text" value={formData.checklist4F.communicationSystem.primarySystem} onChange={(e) => handleChecklist4FChange('communicationSystem', 'primarySystem', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Backup system:</span>
                        <input type="text" value={formData.checklist4F.communicationSystem.backupSystem} onChange={(e) => handleChecklist4FChange('communicationSystem', 'backupSystem', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                    </div>
                  </td>
                </tr>
                {/* 6. Operational supervision */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold align-top">6</td>
                  <td className="border border-gray-600 p-3 text-sm align-top">Operational supervision and watchkeeping</td>
                  <td className="border border-gray-600 p-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Ship 1 responsible persons:</span>
                        <input type="text" value={formData.checklist4F.operationalSupervision.ship1Responsible} onChange={(e) => handleChecklist4FChange('operationalSupervision', 'ship1Responsible', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Ship 2 responsible persons:</span>
                        <input type="text" value={formData.checklist4F.operationalSupervision.ship2Responsible} onChange={(e) => handleChecklist4FChange('operationalSupervision', 'ship2Responsible', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Terminal (if applicable) responsible persons:</span>
                        <input type="text" value={formData.checklist4F.operationalSupervision.terminalResponsible} onChange={(e) => handleChecklist4FChange('operationalSupervision', 'terminalResponsible', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                    </div>
                  </td>
                </tr>
                {/* 7. Smoking restrictions */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold align-top">7</td>
                  <td className="border border-gray-600 p-3 text-sm align-top">Dedicated smoking areas and naked light restrictions</td>
                  <td className="border border-gray-600 p-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Ship 1 restrictions:</span>
                        <input type="text" value={formData.checklist4F.smokingRestrictions.ship1Restrictions} onChange={(e) => handleChecklist4FChange('smokingRestrictions', 'ship1Restrictions', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Ship 2 restrictions:</span>
                        <input type="text" value={formData.checklist4F.smokingRestrictions.ship2Restrictions} onChange={(e) => handleChecklist4FChange('smokingRestrictions', 'ship2Restrictions', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Terminal (if applicable) restrictions:</span>
                        <input type="text" value={formData.checklist4F.smokingRestrictions.terminalRestrictions} onChange={(e) => handleChecklist4FChange('smokingRestrictions', 'terminalRestrictions', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                    </div>
                  </td>
                </tr>
                {/* 8. Stop cargo transfer */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold">8</td>
                  <td className="border border-gray-600 p-3 text-sm">Stop cargo transfer:</td>
                  <td className="border border-gray-600 p-3">
                    <input type="text" value={formData.checklist4F.stopCargoTransfer} onChange={(e) => handleChecklist4FChange('stopCargoTransfer', null, e.target.value)} className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                  </td>
                </tr>
                {/* Environmental limits (between 8 and 9) */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold align-top"></td>
                  <td className="border border-gray-600 p-3 text-sm align-top">Maximum wind, current and sea/swell criteria or other limiting environmental factors</td>
                  <td className="border border-gray-600 p-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Maximum wind speed:</span>
                        <input type="text" value={formData.checklist4F.environmentalLimits.maxWindSpeed} onChange={(e) => handleChecklist4FChange('environmentalLimits', 'maxWindSpeed', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Current:</span>
                        <input type="text" value={formData.checklist4F.environmentalLimits.current} onChange={(e) => handleChecklist4FChange('environmentalLimits', 'current', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Swell:</span>
                        <input type="text" value={formData.checklist4F.environmentalLimits.swell} onChange={(e) => handleChecklist4FChange('environmentalLimits', 'swell', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Disconnect:</span>
                        <input type="text" value={formData.checklist4F.environmentalLimits.disconnect} onChange={(e) => handleChecklist4FChange('environmentalLimits', 'disconnect', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Unmooring:</span>
                        <input type="text" value={formData.checklist4F.environmentalLimits.unmooring} onChange={(e) => handleChecklist4FChange('environmentalLimits', 'unmooring', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                    </div>
                  </td>
                </tr>
                {/* 9. Limits for cargo and ballast handling */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold align-top">9</td>
                  <td className="border border-gray-600 p-3 text-sm align-top">Limits for cargo and ballast handling</td>
                  <td className="border border-gray-600 p-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Maximum transfer rates:</span>
                        <input type="text" value={formData.checklist4F.cargoBallastLimits.maxTransferRates} onChange={(e) => handleChecklist4FChange('cargoBallastLimits', 'maxTransferRates', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Topping off rates:</span>
                        <input type="text" value={formData.checklist4F.cargoBallastLimits.toppingOffRates} onChange={(e) => handleChecklist4FChange('cargoBallastLimits', 'toppingOffRates', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Maximum manifold pressure:</span>
                        <input type="text" value={formData.checklist4F.cargoBallastLimits.maxManifoldPressure} onChange={(e) => handleChecklist4FChange('cargoBallastLimits', 'maxManifoldPressure', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Cargo temperature:</span>
                        <input type="text" value={formData.checklist4F.cargoBallastLimits.cargoTemperature} onChange={(e) => handleChecklist4FChange('cargoBallastLimits', 'cargoTemperature', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Other limitations:</span>
                        <input type="text" value={formData.checklist4F.cargoBallastLimits.otherLimitations} onChange={(e) => handleChecklist4FChange('cargoBallastLimits', 'otherLimitations', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                    </div>
                  </td>
                </tr>
                {/* 10. Pressure surge control */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold align-top">10</td>
                  <td className="border border-gray-600 p-3 text-sm align-top">Pressure surge control</td>
                  <td className="border border-gray-600 p-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Loading ship:</span>
                        <input type="text" value={formData.checklist4F.pressureSurgeControl.loadingShip} onChange={(e) => handleChecklist4FChange('pressureSurgeControl', 'loadingShip', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Minimum number of cargo tanks open:</span>
                        <input type="text" value={formData.checklist4F.pressureSurgeControl.minCargoTanksOpen} onChange={(e) => handleChecklist4FChange('pressureSurgeControl', 'minCargoTanksOpen', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Tank switching protocols:</span>
                        <input type="text" value={formData.checklist4F.pressureSurgeControl.tankSwitchingProtocols} onChange={(e) => handleChecklist4FChange('pressureSurgeControl', 'tankSwitchingProtocols', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Full load rate:</span>
                        <input type="text" value={formData.checklist4F.pressureSurgeControl.fullLoadRate} onChange={(e) => handleChecklist4FChange('pressureSurgeControl', 'fullLoadRate', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Topping off-rate:</span>
                        <input type="text" value={formData.checklist4F.pressureSurgeControl.toppingOffRate} onChange={(e) => handleChecklist4FChange('pressureSurgeControl', 'toppingOffRate', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Closing time automatic valves:</span>
                        <input type="text" value={formData.checklist4F.pressureSurgeControl.closingTimeAutoValves} onChange={(e) => handleChecklist4FChange('pressureSurgeControl', 'closingTimeAutoValves', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                    </div>
                  </td>
                </tr>
                {/* 11. Cargo transfer management */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold align-top">11</td>
                  <td className="border border-gray-600 p-3 text-sm align-top">Cargo transfer management</td>
                  <td className="border border-gray-600 p-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Action notice periods:</span>
                        <input type="text" value={formData.checklist4F.cargoTransferManagement.actionNoticePeriods} onChange={(e) => handleChecklist4FChange('cargoTransferManagement', 'actionNoticePeriods', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Transfer stop protocols:</span>
                        <input type="text" value={formData.checklist4F.cargoTransferManagement.transferStopProtocols} onChange={(e) => handleChecklist4FChange('cargoTransferManagement', 'transferStopProtocols', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                    </div>
                  </td>
                </tr>
                {/* 12. Routine checks */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold align-top">12</td>
                  <td className="border border-gray-600 p-3 text-sm align-top">Routine for regular checks on cargo transferred are agreed</td>
                  <td className="border border-gray-600 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm whitespace-nowrap">Routine transferred quantity checks:</span>
                      <input type="text" value={formData.checklist4F.routineChecks.routineQuantityChecks} onChange={(e) => handleChecklist4FChange('routineChecks', 'routineQuantityChecks', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                    </div>
                  </td>
                </tr>
                {/* 13. Emergency signals */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold align-top">13</td>
                  <td className="border border-gray-600 p-3 text-sm align-top">Emergency signals</td>
                  <td className="border border-gray-600 p-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Ship 1 signal:</span>
                        <input type="text" value={formData.checklist4F.emergencySignals.ship1Signal} onChange={(e) => handleChecklist4FChange('emergencySignals', 'ship1Signal', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Ship 2 signal:</span>
                        <input type="text" value={formData.checklist4F.emergencySignals.ship2Signal} onChange={(e) => handleChecklist4FChange('emergencySignals', 'ship2Signal', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Terminal (if applicable) signal:</span>
                        <input type="text" value={formData.checklist4F.emergencySignals.terminalSignal} onChange={(e) => handleChecklist4FChange('emergencySignals', 'terminalSignal', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                    </div>
                  </td>
                </tr>
                {/* 14. Tank system */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold align-top">14</td>
                  <td className="border border-gray-600 p-3 text-sm align-top">Tank system</td>
                  <td className="border border-gray-600 p-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Ship 1 system:</span>
                        <input type="text" value={formData.checklist4F.tankSystem.ship1System} onChange={(e) => handleChecklist4FChange('tankSystem', 'ship1System', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Ship 2 system:</span>
                        <input type="text" value={formData.checklist4F.tankSystem.ship2System} onChange={(e) => handleChecklist4FChange('tankSystem', 'ship2System', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                    </div>
                  </td>
                </tr>
                {/* 15. Closed operations */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold align-top">15</td>
                  <td className="border border-gray-600 p-3 text-sm align-top">Closed operations</td>
                  <td className="border border-gray-600 p-3">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={formData.checklist4F.closedOperations.notApplicable} onChange={(e) => handleChecklist4FChange('closedOperations', 'notApplicable', e.target.checked)} className="w-4 h-4" />
                        <span className="text-sm">Not applicable</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Requirements:</span>
                        <input type="text" value={formData.checklist4F.closedOperations.requirements} onChange={(e) => handleChecklist4FChange('closedOperations', 'requirements', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                    </div>
                  </td>
                </tr>
                {/* 16. ESD (oil and chemical) */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold align-top">16</td>
                  <td className="border border-gray-600 p-3 text-sm align-top">ESD (oil and chemical)</td>
                  <td className="border border-gray-600 p-3">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={formData.checklist4F.esdOilChemical.notApplicable} onChange={(e) => handleChecklist4FChange('esdOilChemical', 'notApplicable', e.target.checked)} className="w-4 h-4" />
                        <span className="text-sm">Not applicable</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Confirm ESD system:</span>
                        <input type="text" value={formData.checklist4F.esdOilChemical.confirmSystem} onChange={(e) => handleChecklist4FChange('esdOilChemical', 'confirmSystem', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                    </div>
                  </td>
                </tr>
                {/* 17. ESD and ERS systems (LPG and LNG) */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold align-top">17</td>
                  <td className="border border-gray-600 p-3 text-sm align-top">ESD and ERS systems (LPG and LNG)</td>
                  <td className="border border-gray-600 p-3">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={formData.checklist4F.esdErsLpgLng.notApplicable} onChange={(e) => handleChecklist4FChange('esdErsLpgLng', 'notApplicable', e.target.checked)} className="w-4 h-4" />
                        <span className="text-sm">Not applicable</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Fibre optic/electrical link:</span>
                        <input type="text" value={formData.checklist4F.esdErsLpgLng.fibreOpticLink} onChange={(e) => handleChecklist4FChange('esdErsLpgLng', 'fibreOpticLink', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Closing time ESD valve unloading ship:</span>
                        <input type="text" value={formData.checklist4F.esdErsLpgLng.closingTimeUnloadingSeconds} onChange={(e) => handleChecklist4FChange('esdErsLpgLng', 'closingTimeUnloadingSeconds', e.target.value)} className="w-24 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                        <span className="text-sm">seconds</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Closing time ESD valve loading ship:</span>
                        <input type="text" value={formData.checklist4F.esdErsLpgLng.closingTimeLoadingSeconds} onChange={(e) => handleChecklist4FChange('esdErsLpgLng', 'closingTimeLoadingSeconds', e.target.value)} className="w-24 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                        <span className="text-sm">seconds</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm">ERS</span>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={formData.checklist4F.esdErsLpgLng.ersAvailable === true} onChange={() => handleChecklist4FChange('esdErsLpgLng', 'ersAvailable', true)} className="w-4 h-4" />
                          <span className="text-sm">Yes</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input type="checkbox" checked={formData.checklist4F.esdErsLpgLng.ersAvailable === false} onChange={() => handleChecklist4FChange('esdErsLpgLng', 'ersAvailable', false)} className="w-4 h-4" />
                          <span className="text-sm">No</span>
                        </label>
                      </div>
                    </div>
                  </td>
                </tr>
                {/* 18. In case of vapour balancing */}
                <tr className="hover:bg-gray-700">
                  <td className="border border-gray-600 p-3 text-center font-semibold align-top">18</td>
                  <td className="border border-gray-600 p-3 text-sm align-top">In case of vapour balancing</td>
                  <td className="border border-gray-600 p-3">
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={formData.checklist4F.vapourBalancingEmergency.notApplicable} onChange={(e) => handleChecklist4FChange('vapourBalancingEmergency', 'notApplicable', e.target.checked)} className="w-4 h-4" />
                        <span className="text-sm">Not applicable</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm whitespace-nowrap">Which vessel will vent, if needed?</span>
                        <input type="text" value={formData.checklist4F.vapourBalancingEmergency.ventVesselIfNeeded} onChange={(e) => handleChecklist4FChange('vapourBalancingEmergency', 'ventVesselIfNeeded', e.target.value)} className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm" />
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
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
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                />
                {formData.signature.signature && (
                  <div className="mt-2">
                    <img
                      src={formData.signature.signature}
                      alt="Signature preview"
                      className="max-w-full h-24 border border-gray-600 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => handleSignatureChange('signature', '')}
                      className="mt-2 text-sm text-red-400 hover:text-red-300"
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

        {/* Submit error */}
        {submitError && (
          <div className="mb-4 p-3 sm:p-4 bg-red-900/30 border border-red-600 rounded text-red-300">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="font-semibold mb-1 text-sm sm:text-base">Error</p>
                <p className="text-xs sm:text-sm wrap-break-word">{submitError}</p>
              </div>
            </div>
          </div>
        )}
        {/* Submit Button */}
        <div className="flex justify-end gap-3 sm:gap-4">
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-4 sm:px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base w-full sm:w-auto"
          >
            {(() => {
              if (submitting) {
                return isUpdateMode ? 'Updating...' : 'Submitting...';
              }
              return isUpdateMode ? 'Update Checklist' : 'Submit Checklist';
            })()}
          </button>
        </div>
        {submitSuccess && (
          <div className="mt-4 p-3 sm:p-4 bg-green-900/30 border border-green-600 rounded text-green-300 text-xs sm:text-sm">
            {isUpdateMode 
              ? 'Checklist updated successfully.' 
              : 'Form submitted successfully.'
            }
          </div>
        )}
        </div>
      </div>
    </div>
  );
}