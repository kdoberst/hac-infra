import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { axe, toHaveNoViolations } from 'jest-axe';
import { k8sDeleteResource } from '@openshift/dynamic-plugin-sdk-utils';
import WorkspaceDeleteModal from './WorkspaceDeleteModal';

expect.extend(toHaveNoViolations);

jest.mock('@openshift/dynamic-plugin-sdk-utils', () => ({
  ...jest.requireActual('@openshift/dynamic-plugin-sdk-utils'),
  k8sDeleteResource: jest.fn(),
}));
const k8sDeleteResourceMock = k8sDeleteResource as jest.Mock;

const closeModalMock = jest.fn();

describe('Delete workspace modal', () => {
  let rerender: any;

  beforeEach(() => {
    rerender = render(<WorkspaceDeleteModal workspaceName="my-workspace" isOpen closeModal={closeModalMock} />).rerender;
    jest.resetModules();
    k8sDeleteResourceMock.mockClear();
    closeModalMock.mockClear();
  });

  it('Modal opens when isOpen is set to true', () => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Modal is not visible when isOpen is set to false', () => {
    rerender(<WorkspaceDeleteModal workspaceName="my-workspace" isOpen={false} closeModal={closeModalMock} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Modal is accessible', async () => {
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const results = await axe(screen.getByRole('dialog'));
    expect(results).toHaveNoViolations();
  });

  describe('Delete button is disabled if entered name does not match', () => {
    it('Entered name is empty', () => {
      expect(screen.getByRole('textbox')).toHaveValue('');
      expect(screen.getByText('Delete')).toBeDisabled();
    });

    it('Entered name is incorrect and not empty', () => {
      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'notCorrectName' },
      });
      expect(screen.getByText('Delete')).toBeDisabled();

      // check for case sensitivity
      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'My-Workspace' },
      });
      expect(screen.getByText('Delete')).toBeDisabled();
    });

    it('Entered name matches and delete button is enabled', () => {
      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'my-workspace' },
      });
      expect(screen.getByText('Delete')).not.toBeDisabled();
    });
  });

  it('Modal entered name field is cleared when modal is re-opened', () => {
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'notCorrectName' },
    });

    expect(screen.getByRole('textbox')).toHaveValue('notCorrectName');

    // close and open modal
    rerender(<WorkspaceDeleteModal workspaceName="my-workspace" isOpen={false} closeModal={closeModalMock} />);
    rerender(<WorkspaceDeleteModal workspaceName="my-workspace" isOpen closeModal={closeModalMock} />);

    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('Error is shown on modal if delete fails', async () => {
    const err = new Error('test error');
    k8sDeleteResourceMock.mockRejectedValue(err);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'my-workspace' },
    });

    fireEvent.click(screen.getByText('Delete'));

    expect(k8sDeleteResourceMock).toHaveBeenCalledTimes(1);
    expect(k8sDeleteResourceMock).toHaveBeenCalledWith({
      model: {
        apiGroup: 'tenancy.kcp.dev',
        apiVersion: 'v1beta1',
        kind: 'Workspace',
        plural: 'workspaces',
      },
      queryOptions: {
        path: 'my-workspace',
      },
    });

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(closeModalMock).not.toHaveBeenCalled();

    // Check accessibility of modal with alert
    const results = await axe(screen.queryByRole('dialog'));
    expect(results).toHaveNoViolations();
  });

  it('closeModal is called on successful delete', async () => {
    k8sDeleteResourceMock.mockResolvedValue({});
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'my-workspace' },
    });

    fireEvent.click(screen.getByText('Delete'));

    expect(k8sDeleteResourceMock).toHaveBeenCalledTimes(1);

    expect(k8sDeleteResourceMock).toHaveBeenCalledWith({
      model: {
        apiGroup: 'tenancy.kcp.dev',
        apiVersion: 'v1beta1',
        kind: 'Workspace',
        plural: 'workspaces',
      },
      queryOptions: {
        path: 'my-workspace',
      },
    });
    await waitFor(() => expect(closeModalMock).toHaveBeenCalledTimes(1));
  });

  it('Clicking cancel button calls closeModal', () => {
    fireEvent.click(screen.getByText('Cancel'));
    expect(k8sDeleteResourceMock).not.toHaveBeenCalled();
    expect(closeModalMock).toHaveBeenCalledTimes(1);
  });

  it('Clicking cancel "x" calls closeModal', () => {
    fireEvent.click(screen.getByLabelText('Close'));
    expect(k8sDeleteResourceMock).not.toHaveBeenCalled();
    expect(closeModalMock).toHaveBeenCalledTimes(1);
  });
});
