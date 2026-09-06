import { useState } from "react";
import { Download, Upload, ShieldCheck, WifiOff, Trash2 } from "lucide-react";
import { Modal, Confirm } from "./ui";
import {
  isOfflineEnabled,
  enableOffline,
  disableOffline,
  clearAppData,
  cacheOCR,
} from "./offline";
export default function Settings({
  onClose,
  onBackup,
  onRestore,
  temporary,
  onTemporary,
}: {
  onClose: () => void;
  onBackup: () => void;
  onRestore: () => void;
  temporary: boolean;
  onTemporary: (v: boolean) => Promise<void>;
}) {
  const [offline, setOffline] = useState(isOfflineEnabled()),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [clear, setClear] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try {
      if (offline) {
        await disableOffline();
        setOffline(false);
        setMessage(
          "Offline installation removed. Your saved résumés are still here.",
        );
      } else {
        await enableOffline();
        setOffline(true);
        setMessage(
          "Offline editing is ready. Reopen this app on the same device to use it without a connection.",
        );
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title="Your data, your device." onClose={onClose}>
      <div className="privacy-note">
        <ShieldCheck size={24} />
        <p>
          Résumé content is processed in your browser. No account or
          document-upload service is used.
        </p>
      </div>
      <h3>Back up your work</h3>
      <p>
        Drafts are saved in this browser. Clearing site data, private browsing
        or browser storage cleanup can remove them. Backups contain personal
        information; keep them somewhere you trust.
      </p>
      <div className="button-group">
        <button onClick={onBackup}>
          <Download size={16} />
          Download backup
        </button>
        <button onClick={onRestore}>
          <Upload size={16} />
          Restore backup
        </button>
      </div>
      <hr />
      <label className="check">
        <input
          type="checkbox"
          checked={temporary}
          onChange={(e) => {
            void onTemporary(e.target.checked).catch((err) =>
              setMessage(err.message),
            );
          }}
        />{" "}
        Temporary session
      </label>
      <p className="muted">
        When enabled, new edits stay in memory until you download them. Existing
        saved drafts remain on this device.
      </p>
      <hr />
      <h3>
        <WifiOff size={18} />
        Offline editing
      </h3>
      <p>
        Install the app’s files for use without a connection. Scanning tools are
        a separate, larger download.
      </p>
      <button
        disabled={busy || import.meta.env.DEV}
        onClick={() => void toggle()}
      >
        {offline ? "Remove offline installation" : "Enable offline editing"}
      </button>
      {import.meta.env.DEV && (
        <small>Offline installation is available in the published build.</small>
      )}
      {offline && (
        <button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void cacheOCR(setMessage)
              .catch((e) => setMessage(e.message))
              .finally(() => setBusy(false));
          }}
        >
          Download offline scan tools
        </button>
      )}
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      <hr />
      <h3>Privacy details</h3>
      <p className="muted">
        The website host receives normal requests for app files and may keep
        access logs. Your résumé text is not sent with them. Fonts and scan
        tools are hosted with the app. This app has no analytics.
      </p>
      <p className="muted">
        Projects under the same GitHub Pages domain share a browser origin. This
        app uses separate storage names, but a separate custom domain provides
        stronger isolation from other projects.
      </p>
      <p className="muted">
        No automatic device sync or background application reminders. Transfer
        an editable backup manually through Files, AirDrop or your preferred
        channel.
      </p>
      <hr />
      <button className="danger" onClick={() => setClear(true)}>
        <Trash2 size={16} />
        Delete Resume Studio data
      </button>
      {clear && (
        <Confirm
          title="Delete all Resume Studio data on this device?"
          button="Delete all app data"
          onClose={() => setClear(false)}
          onConfirm={() => {
            setBusy(true);
            void clearAppData()
              .then(() => {
                location.hash = "/";
                location.reload();
              })
              .catch((e) => {
                setMessage(e.message);
                setClear(false);
                setBusy(false);
              });
          }}
        >
          This removes local drafts, snapshots, Career Library entries and
          offline files for this app. Download a backup first. Other apps’
          storage is not deliberately cleared.
        </Confirm>
      )}
    </Modal>
  );
}
