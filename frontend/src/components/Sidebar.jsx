import Icon from "./Icon.jsx";

function Sidebar({ isOpen, onToggle, onClose, menuButtonRef }) {
  return (
    <>
      <div className="topbar">
        <button
          ref={menuButtonRef}
          className="menu"
          type="button"
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
          aria-controls="side"
          onClick={onToggle}
        >
          <Icon name="menu" />
        </button>
        <div className="brand">
          <i aria-hidden="true" />
          People Connect
        </div>
      </div>
      {isOpen && (
        <button
          className="shade"
          type="button"
          aria-label="Close menu"
          onClick={onClose}
        />
      )}
      <aside className={`side${isOpen ? " open" : ""}`} id="side">
        <div className="brand">
          <i aria-hidden="true" />
          People Connect
        </div>
        <nav className="links" aria-label="Main">
          <a href="#tasks" aria-current="page" onClick={onClose}>
            <Icon name="tasks" />
            Tasks
          </a>
        </nav>
        <div className="user" aria-label="Static account decoration">
          <div className="me" aria-hidden="true">
            RT
          </div>
          <div>
            My account
            <small>Signed in</small>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
