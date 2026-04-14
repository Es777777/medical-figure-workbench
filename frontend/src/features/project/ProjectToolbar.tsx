type Props = {
  title: string;
  titleLabel: string;
  onTitleChange: (value: string) => void;
  onSaveProject: () => void;
  onOpenProject: () => void;
  onCreateTask: () => void;
  labels: {
    saveProject: string;
    loadProject: string;
    newTask: string;
  };
};

export function ProjectToolbar(props: Props) {
  return (
    <div className="project-toolbar panel">
      <label className="project-title-field">
        <span>{props.titleLabel}</span>
        <input onChange={(event) => props.onTitleChange(event.target.value)} type="text" value={props.title} />
      </label>
      <div className="project-toolbar-actions">
        <button className="secondary-button" onClick={props.onSaveProject} type="button">
          {props.labels.saveProject}
        </button>
        <button className="secondary-button" onClick={props.onOpenProject} type="button">
          {props.labels.loadProject}
        </button>
        <button className="primary-button" onClick={props.onCreateTask} type="button">
          {props.labels.newTask}
        </button>
      </div>
    </div>
  );
}
