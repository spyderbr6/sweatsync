//src/utils/promptAction.tsx

interface ConfirmationOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'default' | 'danger' | 'warning' | 'success';
  }
  
  let activeDialog: HTMLDivElement | null = null;
  let dialogContainer: HTMLDivElement | null = null;
  
  export function promptAction(options: ConfirmationOptions): Promise<boolean> {
    // Create or get dialog container
    if (!dialogContainer) {
      dialogContainer = document.createElement('div');
      dialogContainer.id = 'confirmation-dialog-container';
      document.body.appendChild(dialogContainer);
    }
  
    // Since we just created dialogContainer if it didn't exist,
    // we can now safely assert it exists
    const container = dialogContainer;
  
    // Clean up any existing dialog
    if (activeDialog && container) {
      container.removeChild(activeDialog);
    }
  
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.className = 'modal-overlay';
      
      const modalContent = document.createElement('div');
      modalContent.className = `confirmation-modal ${options.type || 'default'}`;
  
      modalContent.innerHTML = `
        <h3>${options.title}</h3>
        <p>${options.message}</p>
        <div class="confirmation-actions">
          <button class="btn btn-secondary" id="cancel-button">
            ${options.cancelText || 'Cancel'}
          </button>
          <button class="btn btn-${options.type || 'primary'}" id="confirm-button">
            ${options.confirmText || 'Confirm'}
          </button>
        </div>
      `;
  
      dialog.appendChild(modalContent);
      container.appendChild(dialog);
      activeDialog = dialog;
  
      // Add event listeners
      const confirmButton = modalContent.querySelector('#confirm-button');
      const cancelButton = modalContent.querySelector('#cancel-button');
  
      const cleanup = () => {
        if (container && activeDialog) {
          container.removeChild(activeDialog);
          activeDialog = null;
        }
      };
  
      confirmButton?.addEventListener('click', () => {
        cleanup();
        resolve(true);
      });
  
      cancelButton?.addEventListener('click', () => {
        cleanup();
        resolve(false);
      });
  
      // Close on overlay click
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
          cleanup();
          resolve(false);
        }
      });
    });
  }