import React, { useState } from 'react';
import { ApiClient, useNotice } from 'adminjs';
import { Box, Button, H5, Loader, MessageBox, Text } from '@adminjs/design-system';

const api = new ApiClient();

/** The Import page: upload a CSV or JSON file; every row is checked like the "Create new" form */
const Import = ({ resource }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const sendNotice = useNotice();

  const upload = async () => {
    if (!file) return;
    setLoading(true);
    setResults(null);
    try {
      const data = new FormData();
      data.append('file', file, file.name);
      const response = await api.resourceAction({
        method: 'post',
        resourceId: resource.id,
        actionName: 'import',
        data,
      });
      setResults(response.data.results || null);
      if (response.data.notice) sendNotice(response.data.notice);
      const fileError = response.data.record?.errors?.file?.message;
      if (fileError) sendNotice({ message: fileError, type: 'error' });
    } catch (error) {
      sendNotice({ message: error.message, type: 'error' });
    }
    setLoading(false);
  };

  return (
    <Box variant="container">
      <H5>Import {resource.name}</H5>
      <Text mb="lg">
        A CSV file with the field names in the first line, or a JSON list of records - the same format Export
        creates. Id and timestamp columns are ignored.
      </Text>
      <Box mb="lg">
        <input type="file" accept=".csv,.json,text/csv,application/json" onChange={(event) => setFile(event.target.files?.[0] || null)} />
      </Box>
      {loading ? (
        <Loader />
      ) : (
        <Button variant="contained" onClick={upload} disabled={!file}>
          Import
        </Button>
      )}
      {results && (
        <Box mt="xl">
          <MessageBox
            variant={results.failedCount > 0 ? 'danger' : 'success'}
            message={`Imported ${results.created} of ${results.total} rows${results.failedCount ? ` - ${results.failedCount} skipped` : ''}`}
          />
          {results.failed.map((failure) => (
            <Text key={failure.row} mt="sm">
              Row {failure.row}: {failure.message}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default Import;
