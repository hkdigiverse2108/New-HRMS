export interface RecycleBinItem {
  id: string;
  module: string;
  itemName: string;
  deletedAt: number;
  restoreData: {
    storageKey: string;
    isNested?: boolean;
    parentId?: string;
    parentKey?: string;
    nestedArrayKey?: string;
    data: any;
  };
}

export const RECYCLE_BIN_KEY = "hrms_recycle_bin";
export const RECYCLE_BIN_DAYS_LIMIT = 30;

export function getRecycleBinItems(): RecycleBinItem[] {
  try {
    const data = localStorage.getItem(RECYCLE_BIN_KEY);
    if (!data) return [];
    return JSON.parse(data) as RecycleBinItem[];
  } catch (e) {
    console.error("Failed to parse recycle bin data", e);
    return [];
  }
}

export function saveRecycleBinItems(items: RecycleBinItem[]) {
  localStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify(items));
}

export function moveToRecycleBin(
  moduleName: string,
  itemName: string,
  data: any,
  storageKey: string,
  nestedConfig?: {
    parentId: string;
    parentKey: string;
    nestedArrayKey: string;
  }
) {
  const items = getRecycleBinItems();
  
  const restoreDataObj: RecycleBinItem['restoreData'] = {
    storageKey,
    data,
    isNested: !!nestedConfig
  };

  if (nestedConfig?.parentId) restoreDataObj.parentId = nestedConfig.parentId;
  if (nestedConfig?.parentKey) restoreDataObj.parentKey = nestedConfig.parentKey;
  if (nestedConfig?.nestedArrayKey) restoreDataObj.nestedArrayKey = nestedConfig.nestedArrayKey;

  const newItem: RecycleBinItem = {
    id: `rb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    module: moduleName,
    itemName,
    deletedAt: Date.now(),
    restoreData: restoreDataObj
  };

  items.unshift(newItem);
  saveRecycleBinItems(items);
}

export function restoreItem(binId: string): boolean {
  const items = getRecycleBinItems();
  const index = items.findIndex(item => item.id === binId);
  
  if (index === -1) return false;
  
  const itemToRestore = items[index];
  if (!itemToRestore) return false;
  const { restoreData } = itemToRestore;
  
  try {
    const rawData = localStorage.getItem(restoreData.storageKey);
    let targetArray = rawData ? JSON.parse(rawData) : (restoreData.nestedArrayKey === 'restoreAsCategory' ? {} : []);
    
    if (restoreData.isNested && restoreData.parentKey && restoreData.nestedArrayKey) {
      if (restoreData.nestedArrayKey === 'restoreAsCategory') {
        // Special case for restoring object properties (like FinancialPlan categories)
        targetArray[restoreData.parentId!] = restoreData.data;
      } else {
        // Find the parent and insert into the nested array
        const parentIndex = targetArray.findIndex((p: any) => p[restoreData.parentKey!] === restoreData.parentId);
      
        if (parentIndex !== -1) {
          if (!targetArray[parentIndex][restoreData.nestedArrayKey]) {
            targetArray[parentIndex][restoreData.nestedArrayKey] = [];
          }
          targetArray[parentIndex][restoreData.nestedArrayKey].push(restoreData.data);
        } else {
          // If parent is missing, we might not be able to restore properly, or we create a new parent if possible
          // For simplicity, we just won't restore or we just return false
          console.warn(`Parent ${restoreData.parentId} not found in ${restoreData.storageKey}`);
          return false;
        }
      }
    } else {
      // Direct array push
      targetArray.push(restoreData.data);
    }
    
    localStorage.setItem(restoreData.storageKey, JSON.stringify(targetArray));
    
    // Remove from recycle bin
    items.splice(index, 1);
    saveRecycleBinItems(items);
    
    return true;
  } catch (e) {
    console.error("Failed to restore item", e);
    return false;
  }
}

export function permanentlyDeleteItem(binId: string) {
  const items = getRecycleBinItems();
  const newItems = items.filter(item => item.id !== binId);
  saveRecycleBinItems(newItems);
}

export function cleanupOldItems() {
  const items = getRecycleBinItems();
  const now = Date.now();
  const msInDay = 24 * 60 * 60 * 1000;
  
  const validItems = items.filter(item => {
    const daysOld = (now - item.deletedAt) / msInDay;
    return daysOld <= RECYCLE_BIN_DAYS_LIMIT;
  });
  
  if (validItems.length !== items.length) {
    saveRecycleBinItems(validItems);
  }
}
