type Props = {
  title: string;
  createLabel: string;
  tasks: Array<{ id: string; title: string; status: string; updatedAt: string }>;
  currentTaskId: string;
  onSelectTask: (taskId: string) => void;
  onCreateTask: () => void;
};

export function TaskListPanel(props: Props) {
  return (
    <div className="task-list-panel property-block">
      <div className="task-list-header">
        <strong>{props.title}</strong>
        <button className="secondary-button" onClick={props.onCreateTask} type="button">
          {props.createLabel}
        </button>
      </div>
      {props.tasks.map((task) => (
        <button
          className={`task-list-item${task.id === props.currentTaskId ? " is-active" : ""}`}
          key={task.id}
          onClick={() => props.onSelectTask(task.id)}
          type="button"
        >
          <strong>{task.title}</strong>
          <span>{task.status}</span>
          <span>{task.updatedAt}</span>
        </button>
      ))}
    </div>
  );
}
