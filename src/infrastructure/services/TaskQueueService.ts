type TaskType =
	| "upload"
	| "download"
	| "delete"
	| "move"
	| "copy"
	| "create_folder";

type TaskStatus =
	| "queued"
	| "processing"
	| "completed"
	| "failed"
	| "cancelled";

export class Task {
	status: TaskStatus;
	progress: number;
	id: string;
	type: TaskType;
	target: string;
	vaultId: string;
	executor: () => Promise<void>;

	get typeName(): string {
		switch (this.type) {
			case "upload":
				return "Upload";
			case "download":
				return "Download";
			case "delete":
				return "Delete";
			case "move":
				return "Move";
			case "copy":
				return "Copy";
			case "create_folder":
				return "Create Folder";
			default:
				return "Task";
		}
	}

	constructor(dto: {
		type: TaskType;
		target: string;
		vaultId: string;
		executor: () => Promise<void>;
	}) {
		this.id = crypto.randomUUID();
		this.status = "queued";
		this.progress = 0;
		this.type = dto.type;
		this.target = dto.target;
		this.vaultId = dto.vaultId;
		this.executor = dto.executor;
	}
}

export type TaskEventType =
	| "task-added"
	| "task-status-changed"
	| "task-progress-changed"
	| "task-removed";

type TaskEventListener = (eventType: TaskEventType, task: Task) => void;

export class TaskQueueService {
	private tasks: Map<string, Task> = new Map();
	private activeTasks: Set<string> = new Set();
	private isLoopRunning: boolean = false;
	private eventListeners: Set<TaskEventListener> = new Set();

	addEventListener(listener: TaskEventListener): void {
		this.eventListeners.add(listener);
	}

	removeEventListener(listener: TaskEventListener): void {
		this.eventListeners.delete(listener);
	}

	private emitEvent(eventType: TaskEventType, task: Task): void {
		for (const listener of this.eventListeners) {
			listener(eventType, task);
		}
	}

	addTask(task: Task): void {
		this.tasks.set(task.id, task);
		this.emitEvent("task-added", task);
		if (!this.isLoopRunning) {
			this.startLoop();
		}
	}

	private async startLoop(): Promise<void> {
		this.isLoopRunning = true;
		try {
			const tasks = Array.from(this.tasks.values()).filter(
				(task) => task.status === "queued",
			);

			if (tasks.length === 0) {
				this.isLoopRunning = false;
				return;
			}

			await this.processTask(tasks[0]);
		} finally {
			const remainingTasks = Array.from(this.tasks.values()).filter(
				(task) => task.status === "queued",
			);
			if (remainingTasks.length > 0) {
				this.startLoop();
			} else {
				this.isLoopRunning = false;
			}
		}
	}

	private async processTask(task: Task): Promise<void> {
		task.status = "processing";
		this.emitEvent("task-status-changed", task);
		try {
			await task.executor();
			task.status = "completed";
			this.emitEvent("task-status-changed", task);
		} catch (error) {
			task.status = "failed";
			this.emitEvent("task-status-changed", task);
			throw error;
		}
	}

	cancelTask(taskId: string): void {
		const task = this.tasks.get(taskId);
		if (!task || task.status === "completed")
			throw new Error("Task not found or already completed");

		task.status = "cancelled";
		this.emitEvent("task-status-changed", task);
		this.activeTasks.delete(taskId);
	}

	retryTask(taskId: string): void {
		const task = this.tasks.get(taskId);
		if (!task || task.status !== "failed")
			throw new Error("Task not found or not failed");

		task.status = "queued";
		task.progress = 0;
		this.emitEvent("task-status-changed", task);
		if (!this.isLoopRunning) {
			this.startLoop();
		}
	}

	deleteTask(taskId: string): void {
		const task = this.tasks.get(taskId);
		if (!task) throw new Error("Task not found");

		if (task.status === "processing") {
			throw new Error("Cannot delete a processing task");
		}
		this.tasks.delete(taskId);
		this.emitEvent("task-removed", task);
	}

	getAllTasks(): Task[] {
		return Array.from(this.tasks.values());
	}
}
