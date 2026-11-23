step = signal(1);
next = () => this.step.update(s => Math.min(s + 1, this.steps.length - 1));