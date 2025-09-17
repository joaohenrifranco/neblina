<script setup lang="ts">
import {
	CloudFog,
	File,
	Folder,
	Github,
	Home,
	Loader2,
	Plus,
	Settings,
	TriangleAlert,
	Upload,
} from "lucide-vue-next";
import { ref } from "vue";
import { useAppController } from "@/presentation/composables/useAppController";
import { useFileInput } from "@/presentation/composables/useFileInput";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/presentation/ui/breadcrumb";
import { Button } from "@/presentation/ui/button";
import { Card, CardContent } from "@/presentation/ui/card";
import AccountSettingsDialog from "@/presentation/views/components/dialog/AccountSettingsDialog.vue";
import AddAccountDialog from "@/presentation/views/components/dialog/AddAccountDialog.vue";
import CreateFolderDialog from "@/presentation/views/components/dialog/CreateFolderDialog.vue";
import VaultSettingsDialog from "@/presentation/views/components/dialog/VaultSettingsDialog.vue";
import EditBar from "@/presentation/views/components/EditBar.vue";
import EmptyState from "@/presentation/views/components/EmptyState.vue";

const uploadButton = ref<HTMLButtonElement | null>(null);
const controller = useAppController();
const fileInput = useFileInput(uploadButton, controller.uploadFiles);

const openGitHub = () => {
	window.open("https://github.com/joaohenrifranco/secretdrive", "_blank");
};
</script>

<template>
<div class="w-full h-full flex flex-col" ref="uploadButton">
  <div
    class="h-12 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4">
    <div class="flex items-center gap-2">
      <CloudFog class="w-5 h-5 text-primary" />
      <h1 class="text-lg font-semibold">Neblina</h1>
    </div>
    <div class="flex items-center">
      <Button variant="ghost" size="sm" @click="openGitHub" title="View on GitHub" class="h-8 w-8 p-0">
        <Github class="w-4 h-4" />
      </Button>
    </div>
  </div>

  <div class="flex h-[calc(100vh-3rem)] min-h-0">
    <div class="w-80 border-r bg-muted/20 flex flex-col">
      <div class="p-3 flex-1">
        <div class="space-y-4">
          <div v-for="account in controller.accounts.value" :key="account.id" class="space-y-1">
            <div class="group flex items-center gap-2 px-2 py-1.5 rounded-md">
              <div
                class="w-6 h-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center flex-shrink-0">
                <span class="text-xs font-medium text-primary">{{ account.name.charAt(0).toUpperCase() }}</span>
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-sm truncate">{{ account.name }}</span>
                </div>
              </div>

              <div class="flex items-center gap-1">
                <Button variant="ghost" size="sm" @click="controller.setAddVaultDialog(account)"
                  :disabled="controller.getAccountStatus(account) !== 'connected'" title="Add Vault"
                  class="h-6 w-6 p-0">
                  <Plus class="w-4 h-4" />
                </Button>

                <Button variant="ghost" size="sm" @click="controller.setEditingAccount(account)" title="Settings"
                  class="h-6 w-6 p-0">
                  <TriangleAlert v-if="controller.getAccountStatus(account) === 'expired'"
                    class="w-4 h-4 text-destructive" />
                  <Settings v-else class="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div v-if="account.vaults.length > 0" class="space-y-2 ml-2">
              <Card v-for="vault in account.vaults" :key="vault.id" @click="controller.selectVault(vault)" :class="[
                'cursor-pointer transition-colors hover:bg-muted/50',
                vault.id === controller.currentVault.value?.id ? 'bg-primary/10 ring-1 ring-primary/20' : ''
              ]">
                <CardContent class="p-3">
                  <div class="flex items-center justify-between">
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-sm truncate mb-1">{{ vault.name }}</div>
                      <div class="text-xs text-muted-foreground truncate">{{ '/' + (vault.mountPath.join('/') || '') }}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" @click.stop="controller.setEditingVault(vault)"
                      title="Vault Settings" class="h-5 w-5 p-0 ml-2">
                      <Settings class="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div v-else class="flex items-center justify-center">
              <div class="px-2 py-2 text-xs text-muted-foreground text-center">Create your first vault by clicking in
                the + button
              </div>
            </div>
          </div>

          <div v-if="controller.accounts.value.length === 0"
            class="px-4 py-6 text-center text-sm text-muted-foreground">
            <div class="mb-2">No accounts configured</div>
            <div class="text-xs">Add an account to get started</div>
          </div>
        </div>
      </div>

      <div class="p-4 mt-auto">
        <Button variant="outline" size="sm" @click="controller.setAddAccountDialog(true)" class="w-full">
          <Plus class="w-5 h-5 mr-2" />
          Add Account
        </Button>
      </div>
    </div>

    <div class="flex-1 flex flex-col relative min-h-0">
      <div v-if="controller.currentVault.value"
        class="sticky top-0 z-10 h-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink @click="() => controller.navigateToParent(0)" class="flex items-center gap-1.5">
                <Home class="w-4 h-4" />
                <span>{{ controller.currentVault.value?.name }}</span>
              </BreadcrumbLink>
            </BreadcrumbItem>

            <template v-for="(segment, index) in controller.currentPath.value" :key="index">
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink v-if="index < controller.currentPath.value.length - 1"
                  @click="controller.navigateToParent(index)">
                  {{ segment }}
                </BreadcrumbLink>
                <BreadcrumbPage v-else>
                  {{ segment }}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </template>
          </BreadcrumbList>
        </Breadcrumb>

        <div class="flex items-center">
          <EditBar :selected-keys="controller.selectedFileKeys.value" @delete-files="controller.deleteSelectedFiles"
            @download-files="controller.downloadSelectedFiles" @upload-files="fileInput.handleClick()"
            @create-folder="controller.setCreateFolderDialog(true)" />
        </div>
      </div>

      <div class="flex-1 overflow-auto min-h-0">
        <div class="p-6 pb-10">
          <div v-if="controller.fileExplorerState.value === 'loading'"
            class="flex flex-col items-center justify-center mt-20">
            <Loader2 class="w-8 h-8 animate-spin text-primary mb-4" />
            <p class="text-muted-foreground">Loading...</p>
          </div>

          <EmptyState v-else-if="controller.fileExplorerState.value === 'no-accounts'"
            title="Connect Your First Service"
            description="Use your existing cloud account to store files with E2E encryption. Currently, only Google Drive is supported.">
            <Button @click="controller.setAddAccountDialog(true)" class="w-full" :disabled="controller.isLoading.value">
              Connect
            </Button>
          </EmptyState>

          <EmptyState v-else-if="controller.fileExplorerState.value === 'no-vaults'" title="Create Your First Vault"
            :description="`Create an encrypted vault to securely store your files. Use the + button in the account section to create a vault.`">
          </EmptyState>

          <EmptyState v-else-if="controller.fileExplorerState.value === 'no-vault-selected'" title="Select a Vault"
            description="Choose an encrypted vault from the sidebar to start managing your files.">
          </EmptyState>

          <EmptyState v-else-if="controller.fileExplorerState.value === 'account-expired'"
            title="Account Authentication Expired"
            description="Your account authentication has expired. Please re-authenticate to continue accessing your files.">
            <Button
              @click="controller.setEditingAccount(controller.accounts.value.find(account => account.id === controller.currentVault.value?.accountId) ?? null)"
              class="w-full" :disabled="controller.isLoading.value">
              Re-authenticate
            </Button>
          </EmptyState>

          <div v-else>
            <EmptyState v-if="controller.fileExplorerState.value === 'invalid-mount-path'"
              title="Vault Folder Not Found"
              :description="`The vault folder &quot;${controller.currentVault.value?.mountPath.join('/')}&quot; doesn't exist yet. Create it to start storing files.`">
              <div class="space-y-3">
                <Button @click="controller.createMountPath" class="w-full" :disabled="controller.isLoading.value">
                  Create Vault Folder
                </Button>
                <Button variant="outline" @click="controller.setEditingVault(controller.currentVault.value)"
                  class="w-full">
                  <Settings class="w-4 h-4 mr-2" />
                  Vault Settings
                </Button>
              </div>
            </EmptyState>

            <EmptyState v-else-if="controller.fileExplorerState.value === 'folder-not-found'" title="Folder Not Found"
              description="This folder doesn't exist or is empty. Navigate back or create files here.">
            </EmptyState>

            <div v-else-if="controller.fileExplorerState.value === 'file-list'" class="grid gap-2">
              <Card v-for="file in controller.files.value" :key="file.providedId"
                @click="controller.handleFileSelect(file.providedId)" @dblclick="controller.handleFileDoubleClick(file)"
                :class="[
                  'cursor-pointer transition-colors hover:bg-muted/50',
                  controller.isFileSelected(file.providedId) ? 'ring-2 ring-primary' : '',
                ]">
                <CardContent class="flex items-center p-4">
                  <Folder v-if="file.type === 'folder'" class="w-5 h-5 mr-3 text-primary" />
                  <File v-else class="w-5 h-5 mr-3 text-muted-foreground" />
                  <span class="flex-1">{{ controller.getFileName(file) }}</span>
                </CardContent>
              </Card>
            </div>

            <EmptyState v-else-if="controller.fileExplorerState.value === 'no-files'" title="Folder empty">
              <Button @click="fileInput.handleClick()" class="w-full">
                <Upload class="w-4 h-4 mr-2" />
                Upload Files
              </Button>
            </EmptyState>
          </div>
        </div>
      </div>

      <div v-if="controller.currentVault.value"
        class="sticky bottom-0 h-8 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-center px-4 text-xs mt-auto">
        <div class="flex items-center gap-4 text-muted-foreground">
          <span v-if="controller.selectedFileKeys.value.length > 0" class="font-medium">
            {{ controller.selectedFileKeys.value.length }} selected
          </span>
          <span>{{ controller.files.value?.length || 0 }} items</span>
        </div>
      </div>
    </div>
  </div>

  <CreateFolderDialog :open="controller.showCreateFolderDialog.value" @update:open="controller.setCreateFolderDialog"
    @save="controller.createFolder" :loading="controller.isLoading.value" />

  <AddAccountDialog :open="controller.showAddAccountDialog.value" @update:open="controller.setAddAccountDialog"
    @save="controller.createAccount" :available-providers="controller.availableProviders"
    :loading="controller.isLoading.value" />

  <AccountSettingsDialog :open="!!controller.editingAccount.value && !!controller.editingAccount.value.id"
    @update:open="val => val ? null : controller.setEditingAccount(null)" @save="controller.updateAccountName"
    @reauth="controller.authenticateAccount" @delete="controller.deleteAccount"
    :account="controller.editingAccount.value" :loading="controller.isLoading.value" />

  <VaultSettingsDialog v-if="controller.editingVault.value" :open="!!controller.editingVault.value"
    @update:open="val => val ? null : controller.setEditingVault(null)" @save="controller.saveVault"
    @delete="controller.deleteVault" :vault="controller.editingVault.value" :loading="controller.isLoading.value" />
</div>
</template>
