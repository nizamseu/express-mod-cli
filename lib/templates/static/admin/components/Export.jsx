import React, { useState } from 'react';
import { ApiClient, useNotice } from 'adminjs';
import { Box, Button, H5, Loader, Text } from '@adminjs/design-system';

const api = new ApiClient();

/** The Export page: download the records (with the list's current filters) as CSV or JSON */
const Export = ({ resource }) => {
  const [loading, setLoading] = useState(false);
  const sendNotice = useNotice();

  // Filters chosen on the list page travel in the address (?filters.status=draft)
  const filters = Object.fromEntries(
    [...new URLSearchParams(window.location.search)].filter(([key]) => key.startsWith('filters.'))
  );

  const download = async (type) => {
    setLoading(true);
    try {
      const { data } = await api.resourceAction({
        method: 'post',
        resourceId: resource.id,
        actionName: 'export',
        params: { ...filters, type },
      });
      const url = URL.createObjectURL(new Blob([data.exportedData], { type: data.mimeType }));
      const link = document.createElement('a');
      link.href = url;
      link.download = data.fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      sendNotice({ message: error.message, type: 'error' });
    }
    setLoading(false);
  };

  return (
    <Box variant="container">
      <H5>Export {resource.name}</H5>
      <Text mb="xl">
        {Object.keys(filters).length > 0 ? 'Records matching the current filters.' : 'All records.'} Hidden fields
        (such as passwords) are never exported.
      </Text>
      {loading ? (
        <Loader />
      ) : (
        <Box flex style={{ gap: 8 }}>
          <Button variant="contained" onClick={() => download('csv')}>Download CSV</Button>
          <Button onClick={() => download('json')}>Download JSON</Button>
        </Box>
      )}
    </Box>
  );
};

export default Export;
