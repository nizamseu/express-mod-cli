import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { ApiClient, useTranslation } from 'adminjs';
import { Badge, Box, H2, H4, Table, TableBody, TableCell, TableRow, Text } from '@adminjs/design-system';

const api = new ApiClient();

const ACTION_ICONS = { add: '+', change: '✎', delete: '✕', import: '⇪' };

/**
 * Home page of the admin panel: every resource, grouped like the sidebar,
 * with its number of records and links to add or change records.
 */
const Dashboard = () => {
  const resources = useSelector((state) => state.resources);
  const rootPath = useSelector((state) => state.paths.rootPath);
  const { translateLabel } = useTranslation();
  const [data, setData] = useState({ counts: {}, recent: [] });

  useEffect(() => {
    api
      .getDashboard()
      .then((response) => setData(response.data || { counts: {}, recent: [] }))
      .catch(() => setData({ counts: {}, recent: [] }));
  }, []);

  const groups = {};
  for (const resource of resources) {
    if (!resource.href || resource.navigation?.show === false) continue;
    const group = resource.navigation?.name || 'Resources';
    (groups[group] = groups[group] || []).push(resource);
  }

  const labelOf = (id) => {
    const resource = resources.find((item) => item.id === id);
    return resource ? translateLabel(resource.name, resource.id) : id;
  };

  return (
    <Box variant="grey">
      <Box mb="xl">
        <H2 mb="sm">{data.title || 'Administration'}</H2>
        <Text color="grey60">Site administration</Text>
      </Box>

      <Box flex style={{ gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <Box style={{ flex: '1 1 480px', maxWidth: 720 }}>
      {Object.entries(groups).map(([group, items]) => (
        <Box key={group} variant="container" mb="xl" p="0">
          <Box bg="primary100" px="lg" py="default">
            <H4 mb="0" style={{ color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>
              {group}
            </H4>
          </Box>
          <Table width="100%">
            <TableBody>
              {items.map((resource) => {
                const canAdd = resource.resourceActions.some((action) => action.name === 'new');
                const count = data.counts?.[resource.id];

                return (
                  <TableRow key={resource.id}>
                    <TableCell>
                      <Link to={resource.href}>{translateLabel(resource.name, resource.id)}</Link>
                    </TableCell>
                    <TableCell width="1%">
                      <Badge size="sm">{count === undefined ? '…' : count}</Badge>
                    </TableCell>
                    <TableCell width="1%" style={{ whiteSpace: 'nowrap' }}>
                      {canAdd && <Link to={`${resource.href}/actions/new`}>+ Add</Link>}
                    </TableCell>
                    <TableCell width="1%" style={{ whiteSpace: 'nowrap' }}>
                      <Link to={resource.href}>Change</Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      ))}
      </Box>

      <Box variant="container" style={{ flex: '0 1 300px' }}>
        <H4>Recent actions</H4>
        <Text color="grey60" mb="lg">My actions</Text>
        {(data.recent || []).length === 0 && <Text>None available</Text>}
        {(data.recent || []).map((log) => {
          const canOpen = log.recordId && log.action !== 'delete' && log.action !== 'import';
          const href = `${rootPath}/resources/${log.resource}/records/${encodeURIComponent(log.recordId)}/show`;
          return (
            <Box key={log.id} mb="lg">
              <Text>
                <span style={{ display: 'inline-block', width: 18 }}>{ACTION_ICONS[log.action] || '•'}</span>
                {canOpen ? <Link to={href}>{log.recordTitle || log.recordId}</Link> : log.recordTitle || log.recordId}
              </Text>
              <Text color="grey60" fontSize="sm" ml="18px">
                {labelOf(log.resource)}
                {log.changes ? ` - changed ${log.changes}` : ''}
              </Text>
            </Box>
          );
        })}
      </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;
