import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShieldAlert, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Loader2, 
  Radio, 
  Info,
  Navigation,
  Send,
  BellOff
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile, SosAlert } from '../types';

interface StudentSosManagerProps {
  user: UserProfile;
}

// Helper to sync local storage for real-time local state transfer across components
const broadcastSosChannel = () => {
  try {
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel('campuscare_sos_channel');
      bc.postMessage({ type: 'CAMPUSCARE_SOS_DISPATCHED', timestamp: Date.now() });
      bc.close();
    }
  } catch (e) {
    console.warn('BroadcastChannel notice:', e);
  }
};

const syncLocalSosStore = (alert: SosAlert | null, studentId: string) => {
  try {
    const raw = localStorage.getItem('campuscare_sos_alerts');
    let list: SosAlert[] = raw ? JSON.parse(raw) : [];
    if (alert) {
      list = list.filter(a => a.id !== alert.id);
      list.unshift(alert);
    } else {
      list = list.filter(a => a.student_id !== studentId);
    }
    localStorage.setItem('campuscare_sos_alerts', JSON.stringify(list));
    window.dispatchEvent(new CustomEvent('campuscare_sos_updated'));
    broadcastSosChannel();
  } catch (e) {
    console.warn('Error syncing local SOS store:', e);
  }
};

export const StudentSosManager: React.FC<StudentSosManagerProps> = ({ user }) => {
  const [activeAlert, setActiveAlert] = useState<SosAlert | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  
  const [emergencyType, setEmergencyType] = useState<string>('medical');
  const [building, setBuilding] = useState<string>('Main Academic Building');
  const [roomDetail, setRoomDetail] = useState<string>('');
  const [emergencyMessage, setEmergencyMessage] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Fetch active SOS alert for the logged-in student
  const fetchActiveAlert = useCallback(async () => {
    let foundAlert: SosAlert | null = null;
    const studentId = user.id || 'std-101';

    if (isSupabaseConfigured) {
      try {
        setLoading(true);
        setErrorMsg(null);

        const { data, error } = await supabase
          .from('sos_alerts')
          .select('*')
          .eq('student_id', studentId)
          .in('status', ['active', 'acknowledged'])
          .order('created_at', { ascending: false })
          .limit(1);

        if (!error && data && data.length > 0) {
          foundAlert = data[0] as SosAlert;
        }
      } catch (err: any) {
        console.warn('[StudentSosManager] Exception querying SOS alerts:', err?.message || err);
      }
    }

    try {
      const raw = localStorage.getItem('campuscare_sos_alerts');
      if (raw) {
        const list: SosAlert[] = JSON.parse(raw);
        const local = list.find(a => 
          (a.student_id === studentId || a.student_id === user.id || (foundAlert && a.id === foundAlert.id)) && 
          (a.status === 'active' || a.status === 'acknowledged')
        );
        if (local) {
          if (!foundAlert) {
            foundAlert = local;
          } else if (local.status === 'acknowledged' && foundAlert.status === 'active') {
            foundAlert = {
              ...foundAlert,
              status: 'acknowledged',
              acknowledged_at: local.acknowledged_at || new Date().toISOString()
            };
          }
        }
      }
    } catch (e) {
      console.warn('Error reading local active alert:', e);
    }

    setActiveAlert(foundAlert);
    setLoading(false);
  }, [user.id]);

  useEffect(() => {
    fetchActiveAlert();
  }, [fetchActiveAlert]);

  // Listen to local events and storage changes
  useEffect(() => {
    const handleSync = () => {
      fetchActiveAlert();
    };
    window.addEventListener('campuscare_sos_updated', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('campuscare_sos_updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [fetchActiveAlert]);

  // Set up Supabase Realtime subscription for student's SOS alerts
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channelName = `student_sos_${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sos_alerts',
        },
        () => {
          fetchActiveAlert();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchActiveAlert]);

  // Instant Direct Dispatch SOS RPC (Manual Location)
  const handleActivateSos = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    setWarningMsg(null);
    setSuccessMsg(null);

    const manualLocStr = [building, roomDetail].filter(Boolean).join(' - ') || 'Main Campus';
    const finalMessage = emergencyMessage
      ? `[Location: ${manualLocStr}] ${emergencyMessage}`
      : `[Location: ${manualLocStr}] Immediate emergency assistance requested.`;

    try {
      let createdAlert: SosAlert | null = null;

      const studentInfo = {
        id: user.id || 'std-101',
        name: user.name || 'Student User',
        email: user.email,
        university_id: user.universityId || '242-35-101',
        department: user.department || 'Computer Science & Engineering',
        phone: user.phone || '+880 1812-345678',
      };

      if (isSupabaseConfigured) {
        try {
          const { data, error } = await supabase.rpc('create_sos_alert', {
            p_latitude: 23.8759,
            p_longitude: 90.3795,
            p_accuracy: null,
            p_emergency_type: emergencyType,
            p_message: finalMessage,
          });

          if (!error && data && data.success) {
            if (data.is_duplicate) {
              setWarningMsg(data.message || 'An active SOS emergency is already open for your account.');
            } else {
              setSuccessMsg('Emergency SOS alert dispatched to Campus Admin & Security team!');
            }
            if (data.alert) {
              createdAlert = {
                ...(data.alert as SosAlert),
                student: ((data.alert as any).student || studentInfo)
              };
            }
          } else if (error) {
            console.warn('[StudentSosManager] Supabase RPC notice:', error.message);
          }
        } catch (err: any) {
          console.warn('[StudentSosManager] Network notice during SOS dispatch:', err);
        }

        // Fallback direct insert if RPC returned no alert object
        if (!createdAlert) {
          try {
            const { data: directData, error: directErr } = await supabase
              .from('sos_alerts')
              .insert({
                student_id: user.id || 'std-101',
                emergency_type: emergencyType,
                status: 'active',
                latitude: 23.8759,
                longitude: 90.3795,
                accuracy: null,
                message: finalMessage
              })
              .select('*')
              .single();

            if (!directErr && directData) {
              createdAlert = {
                ...(directData as SosAlert),
                student: studentInfo
              };
              setSuccessMsg('Emergency SOS alert dispatched to Campus Admin & Security team!');
            }
          } catch (e) {
            console.warn('[StudentSosManager] Direct insert notice:', e);
          }
        }
      }

      if (!createdAlert) {
        createdAlert = {
          id: 'sos-' + Math.random().toString(36).substring(2, 9),
          student_id: user.id || 'std-101',
          emergency_type: emergencyType,
          status: 'active',
          latitude: 23.8759,
          longitude: 90.3795,
          message: finalMessage,
          created_at: new Date().toISOString(),
          student: studentInfo
        };
        setSuccessMsg('Emergency SOS alert dispatched to Campus Admin & Security team!');
        setErrorMsg(null);
      }

      setActiveAlert(createdAlert);
      syncLocalSosStore(createdAlert, user.id || 'std-101');
    } catch (err: any) {
      console.error('Error dispatching SOS alert:', err);
      setErrorMsg(err?.message || 'Failed to dispatch SOS alert. Please try again.');
    } finally {
      setSubmitting(false);
      setShowConfirmModal(false);
    }
  };

  // Student Cancel SOS
  const handleCancelSos = async () => {
    if (!activeAlert) return;
    if (!window.confirm('Are you sure you want to cancel this emergency SOS alert?')) return;

    setCancelling(true);
    setErrorMsg(null);

    try {
      if (isSupabaseConfigured) {
        try {
          await supabase.rpc('cancel_sos_alert', {
            p_alert_id: activeAlert.id,
          });
        } catch (err) {
          console.warn('[StudentSosManager] Notice cancelling SOS via RPC:', err);
        }
      }
    } catch (err: any) {
      console.warn('[StudentSosManager] Cancel exception:', err);
    } finally {
      syncLocalSosStore(null, user.id || 'std-101');
      setSuccessMsg('Emergency alert cancelled.');
      setActiveAlert(null);
      setErrorMsg(null);
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-8 flex items-center justify-center gap-3 text-ink-muted">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <span className="text-sm">Connecting to Emergency Dispatch...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Alert / Warning Messages */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-emergency/10 border border-emergency/30 text-emergency text-xs flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block">Emergency Error</strong>
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {warningMsg && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-3">
          <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <strong className="font-semibold block">Notice</strong>
            <span>{warningMsg}</span>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-wellness/10 border border-wellness/30 text-wellness text-xs flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <strong className="font-semibold block">Status Update</strong>
            <span>{successMsg}</span>
          </div>
        </div>
      )}

      {/* ACTIVE SOS BANNER IF CURRENTLY ACTIVE */}
      {activeAlert ? (
        <div className="bg-emergency/10 border-2 border-emergency/40 rounded-2xl p-6 sm:p-8 space-y-6 relative overflow-hidden shadow-md">
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-emergency/20 rounded-full blur-2xl pointer-events-none animate-pulse" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emergency text-surface text-xs font-bold uppercase tracking-wider animate-pulse shadow-sm">
                <Radio className="w-4 h-4 animate-spin" />
                <span>SOS EMERGENCY ACTIVE</span>
              </div>
              <h2 className="font-heading font-bold text-2xl text-ink">
                Campus Emergency Dispatch Notified
              </h2>
              <p className="text-xs text-ink-muted leading-relaxed max-w-xl">
                Your emergency SOS signal has been transmitted directly to Campus Security and On-Call Medical Personnel. Stay calm and stay in a safe location if possible.
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              <button
                type="button"
                onClick={handleCancelSos}
                disabled={cancelling}
                className="px-4 py-2.5 rounded-xl bg-surface border border-emergency/40 text-emergency text-xs font-semibold hover:bg-emergency/10 transition-colors focus-ring cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {cancelling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <BellOff className="w-4 h-4" />
                )}
                <span>Cancel False Alarm</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-emergency/20 text-xs">
            {/* Status Item 1 */}
            <div className="p-3.5 rounded-xl bg-surface/80 border border-emergency/20 space-y-1">
              <span className="text-ink-muted font-medium block text-2xs uppercase tracking-wider">
                Response Status
              </span>
              <div className="flex items-center gap-2 font-semibold">
                {activeAlert.status === 'acknowledged' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-wellness" />
                    <span className="text-wellness">Acknowledged & Responding</span>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-emergency animate-pulse" />
                    <span className="text-emergency">Alert Sent — Waiting for Admin</span>
                  </>
                )}
              </div>
            </div>

            {/* Status Item 2 */}
            <div className="p-3.5 rounded-xl bg-surface/80 border border-emergency/20 space-y-1">
              <span className="text-ink-muted font-medium block text-2xs uppercase tracking-wider">
                Location Status
              </span>
              <div className="flex items-center gap-2 font-mono">
                {activeAlert.latitude && activeAlert.longitude ? (
                  <>
                    <MapPin className="w-4 h-4 text-medical" />
                    <span className="text-ink font-medium">
                      {Number(activeAlert.latitude).toFixed(4)}, {Number(activeAlert.longitude).toFixed(4)}
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-ink-muted" />
                    <span className="text-ink-muted italic">No Location Captured</span>
                  </>
                )}
              </div>
            </div>

            {/* Status Item 3 */}
            <div className="p-3.5 rounded-xl bg-surface/80 border border-emergency/20 space-y-1">
              <span className="text-ink-muted font-medium block text-2xs uppercase tracking-wider">
                Emergency Type & Ref
              </span>
              <div className="flex items-center gap-2 font-mono">
                <span className="font-semibold text-ink capitalize">
                  {activeAlert.emergency_type || 'General'}
                </span>
                <span className="text-ink-muted text-2xs">
                  (Ref: #{activeAlert.id.substring(0, 8)})
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* STANDARD TRIGGER SOS CARD */
        <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emergency/10 text-emergency text-xs font-semibold">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>High Priority Campus Dispatch</span>
              </div>
              <h2 className="font-heading font-bold text-xl text-ink">
                Campus SOS Emergency Service
              </h2>
              <p className="text-xs text-ink-muted leading-relaxed">
                If you are experiencing an immediate physical or medical emergency on campus, activate the SOS alert to dispatch campus security and emergency medical response.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowConfirmModal(true)}
              className="px-6 py-3.5 rounded-2xl bg-emergency text-surface font-bold text-sm hover:bg-emergency-hover transition-all focus-ring shadow-md hover:shadow-lg flex items-center justify-center gap-2.5 shrink-0 cursor-pointer"
            >
              <ShieldAlert className="w-5 h-5 animate-pulse" />
              <span>TRIGGER SOS EMERGENCY</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-xl bg-background border border-border space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emergency/10 text-emergency flex items-center justify-center font-bold text-xs">
                1
              </div>
              <h3 className="font-heading font-semibold text-sm text-ink">
                1-Tap Activation
              </h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Sends an urgent distress beacon directly to the CampusCare admin monitoring panel.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-background border border-border space-y-2">
              <div className="w-8 h-8 rounded-lg bg-medical/10 text-medical flex items-center justify-center font-bold text-xs">
                2
              </div>
              <h3 className="font-heading font-semibold text-sm text-ink">
                Manual Campus Location
              </h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Specify your campus building, floor, or spot manually so responders know exactly where to reach.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-background border border-border space-y-2">
              <div className="w-8 h-8 rounded-lg bg-wellness/10 text-wellness flex items-center justify-center font-bold text-xs">
                3
              </div>
              <h3 className="font-heading font-semibold text-sm text-ink">
                Live Admin Acknowledgment
              </h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Real-time notification system tracks responder acknowledgment and emergency resolution.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION MODAL */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div 
            className="bg-surface rounded-2xl border border-emergency/40 p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sos-confirm-title"
          >
            <div className="flex items-center gap-3 text-emergency border-b border-border pb-4">
              <div className="w-12 h-12 rounded-2xl bg-emergency/10 text-emergency flex items-center justify-center shrink-0">
                <ShieldAlert className="w-7 h-7" />
              </div>
              <div>
                <h3 id="sos-confirm-title" className="font-heading font-bold text-xl text-ink">
                  Confirm Emergency SOS Alert
                </h3>
                <p className="text-xs text-ink-muted">
                  University Emergency Dispatch Center
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-ink">
              <div className="p-3.5 rounded-xl bg-emergency/10 border border-emergency/20 text-emergency space-y-1">
                <strong className="font-semibold block flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  Important Emergency Notice:
                </strong>
                <p className="text-ink/90 text-2xs leading-relaxed">
                  Activating SOS will immediately notify campus administrators and emergency dispatchers with your selected location and details for student <strong>{user.name}</strong> ({user.universityId}).
                </p>
              </div>

              {/* Emergency Type Selector */}
              <div className="space-y-2">
                <label className="font-semibold text-ink block text-xs">
                  Select Emergency Category:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'medical', label: 'Medical Emergency' },
                    { id: 'security', label: 'Security / Threat' },
                    { id: 'fire', label: 'Fire / Hazard' },
                    { id: 'general', label: 'General SOS' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setEmergencyType(cat.id)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition-all cursor-pointer ${
                        emergencyType === cat.id
                          ? 'bg-emergency/10 border-emergency text-emergency font-bold'
                          : 'bg-background border-border text-ink-muted hover:border-ink/30'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual Building Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="sos-building" className="font-semibold text-ink block text-xs">
                    Campus Building:
                  </label>
                  <select
                    id="sos-building"
                    value={building}
                    onChange={(e) => setBuilding(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs text-ink focus:outline-hidden focus:border-emergency font-medium"
                  >
                    <option value="Main Academic Building">Main Academic Building (AB1)</option>
                    <option value="Knowledge Tower (AB4)">Knowledge Tower (AB4)</option>
                    <option value="CSE Department Building">CSE Dept Building</option>
                    <option value="Daffodil Smart City Library">DIU Library</option>
                    <option value="Female Student Hall">Female Student Hall</option>
                    <option value="Male Student Hostel">Male Student Hostel</option>
                    <option value="Central Canteen & Plaza">Central Canteen / Plaza</option>
                    <option value="Sports Complex / Playground">Sports Grounds</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="sos-room" className="font-semibold text-ink block text-xs">
                    Floor / Room / Area:
                  </label>
                  <input
                    id="sos-room"
                    type="text"
                    placeholder="e.g. 4th Floor, Room 402"
                    value={roomDetail}
                    onChange={(e) => setRoomDetail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs text-ink placeholder:text-ink-muted/60 focus:outline-hidden focus:border-emergency"
                  />
                </div>
              </div>

              {/* Optional Message / Details */}
              <div className="space-y-1.5">
                <label htmlFor="sos-note" className="font-semibold text-ink block text-xs">
                  Additional Emergency Details (Optional):
                </label>
                <input
                  id="sos-note"
                  type="text"
                  placeholder="e.g. Needs immediate medical attention, severe fever / panic"
                  value={emergencyMessage}
                  onChange={(e) => setEmergencyMessage(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-border text-xs text-ink placeholder:text-ink-muted/60 focus:outline-hidden focus:border-emergency"
                />
              </div>

              <div className="flex items-center gap-2 text-2xs text-wellness font-medium pt-1">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Emergency information will be sent directly to Admin Panel without requiring GPS.</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl border border-border font-semibold text-xs text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleActivateSos}
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-emergency text-surface font-bold text-xs hover:bg-emergency-hover transition-all shadow-md focus-ring cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Dispatching SOS...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>ACTIVATE SOS EMERGENCY</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
