import { EMPLOYEES } from "@/components/employees/employee-data";
import { useState, useEffect } from "react";

export function useApi() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate fetch
    setTimeout(() => {
      setData({
        employees: EMPLOYEES.map(emp => ({
          ...emp,
          id: emp.name.toLowerCase().replace(/\s+/g, '-'),
          firstName: emp.name.split(' ')[0],
          lastName: emp.name.split(' ')[1] || '',
          profilePhoto: emp.avatar
        })),
        assets: []
      });
      setIsLoading(false);
    }, 500);
  }, []);

  const refresh = () => {};
  const updateData = async (url: string, config: any) => {};

  return { data, isLoading, refresh, updateData };
}
