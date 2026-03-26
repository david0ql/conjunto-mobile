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
  status: 'ringing' | 'active' | 'ended' | 'missed' | 'rejected';
  apartmentId: string;
  apartment: CallApartmentSummary | null;
  initiatedByEmployeeId: string;
  initiatedByEmployee: CallPeerSummary | null;
  acceptedByResidentId: string | null;
  acceptedByResident: CallPeerSummary | null;
  targetResidentIds: string[];
  rejectedResidentIds: string[];
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
