type Props = {
  title: string;
  createLabel: string;
  deleteLabel: string;
  dragLabel: string;
  tasks: Array<{ id: string; title: string; status: string; updatedAt: string }>;
  currentTaskId: string;
  onSelectTask: (taskId: string) => void;
  onCreateTask: () => void;
  onMoveTask: (taskId: string, nextIndex: number) => void;
  onDeleteTask: (taskId: string) => void;
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
      {props.tasks.map((task, index) => (
        <article
          className={`task-list-item${task.id === props.currentTaskId ? " is-active" : ""}`}
          draggable
          key={task.id}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            const movingTaskId = event.dataTransfer.getData("text/task-id");
            if (movingTaskId) {
              props.onMoveTask(movingTaskId, index);
            }
          }}
          onDragStart={(event) => {
            event.dataTransfer.setData("text/task-id", task.id);
          }}
        >
          <button className="task-list-item-body" onClick={() => props.onSelectTask(task.id)} type="button">
            <strong>{task.title}</strong>
            <div className="task-item-status-row">
              <span className="task-status-badge">{task.status}</span>
              <span>{task.updatedAt}</span>
            </div>
          </button>
          <div className="task-item-actions">
            <span className="task-drag-hint">{props.dragLabel}</span>
            <button
              className="task-action-button task-delete-button"
              onClick={(event) => {
                event.stopPropagation();
                props.onDeleteTask(task.id);
              }}
              type="button"
            >
              {props.deleteLabel}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
