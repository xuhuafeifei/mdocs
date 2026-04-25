export function VisitorIdNotice(props: {
  visitorId: string;
  onDismiss: () => void;
}) {
  return (
    <div className="mdocs-notice card">
      <span>
        your visitor id is <code>{props.visitorId}</code>, save it for recovery
      </span>
      <button type="button" onClick={props.onDismiss}>
        got it
      </button>
    </div>
  );
}
