export interface CallPeerSummary {
  id: string;
  name: string;
  lastName: string;
}

export interface CallApartmentSummary {
  id: string;
  number: string;
  floor: number | null;
  tower: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export interface RealtimeIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface CallSessionPayload {
  id: string;
  direction: 'outbound' | 'inbound' | 'internal';
  status: 'ringing' | 'active' | 'ended' | 'missed' | 'rejected';
  apartmentId: string | null;
  apartment: CallApartmentSummary | null;
  initiatedByEmployeeId: string | null;
  initiatedByEmployee: CallPeerSummary | null;
  initiatedByResidentId: string | null;
  initiatedByResident: CallPeerSummary | null;
  acceptedByResidentId: string | null;
  acceptedByResident: CallPeerSummary | null;
  acceptedByEmployeeId: string | null;
  acceptedByEmployee: CallPeerSummary | null;
  targetResidentIds: string[];
  targetEmployeeIds: string[];
  rejectedResidentIds: string[];
  rejectedEmployeeIds: string[];
  endedByUserId: string | null;
  endedByUserType: 'employee' | 'resident' | null;
  endedReason: string | null;
  createdAt: string;
  acceptedAt: string | null;
  endedAt: string | null;
}

export interface IceConfigResponse {
  iceServers: RealtimeIceServer[];
}

export interface CallSignalEnvelope {
  type: 'offer' | 'answer' | 'ice-candidate';
  sdp?: string;
  candidate?: {
    candidate: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
  };
}
