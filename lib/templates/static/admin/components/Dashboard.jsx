import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { ApiClient, useTranslation } from 'adminjs';
import { Badge, Box, H2, H4, Table, TableBody, TableCell, TableRow, Text } from '@adminjs/design-system';

const api = new ApiClient();

const ACTION_ICONS = { add: '+', change: '✎', delete: '✕', import: '⇪' };
const EMPTY = { counts: {}, recent: [], activity: [] };

/** The resources of the sidebar, grouped by their sidebar section */
function groupResources(resources) {
  const groups = {};
  for (const resource of resources) {
    if (!resource.href || resource.navigation?.show === false) continue;
    const group = resource.navigation?.name || 'Resources';
    (groups[group] = groups[group] || []).push(resource);
  }
  return groups;
}

/** "My actions": the logged-in user's latest adds, changes and deletes */
const RecentActions = ({ recent, rootPath, labelOf, title = 'Recent actions', subtitle = 'My actions' }) => (
  <Box variant="container" style={{ flex: '0 1 320px', minWidth: 260 }}>
    <H4>{title}</H4>
    <Text color="grey60" mb="lg">{subtitle}</Text>
    {recent.length === 0 && <Text>None available</Text>}
    {recent.map((log) => {
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
);

/** Classic themes: a table per section with Add / Change links, and recent actions */
const ClassicHome = ({ data, groups, rootPath, labelOf }) => (
  <Box variant="grey">
    <Box mb="xl">
      <H2 mb="sm">Site administration</H2>
      <Text color="grey60">{data.title}</Text>
    </Box>

    <Box flex style={{ gap: 32, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <Box style={{ flex: '1 1 480px', maxWidth: 720 }}>
        {Object.entries(groups).map(([group, items]) => (
          <Box key={group} variant="container" mb="xl" p="0">
            <Box bg="primary100" px="lg" py="default">
              <H4 mb="0" style={{ color: '#fff', textTransform: 'uppercase', letterSpacing: 1, fontSize: 13 }}>
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
                        <Link to={resource.href}>{labelOf(resource.id)}</Link>
                      </TableCell>
                      <TableCell width="1%">
                        <Badge size="sm">{count === undefined ? '…' : count}</Badge>
                      </TableCell>
                      <TableCell width="1%" style={{ whiteSpace: 'nowrap' }}>
                        {canAdd && <Link to={`${resource.href}/actions/new`}>+ Add</Link>}
                      </TableCell>
                      <TableCell width="1%" style={{ whiteSpace: 'nowrap' }}>
                        <Link to={resource.href}>✎ Change</Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        ))}
      </Box>

      <RecentActions recent={data.recent || []} rootPath={rootPath} labelOf={labelOf} />
    </Box>
  </Box>
);

const card = { borderRadius: 14, boxShadow: '0 1px 3px rgba(17, 24, 39, 0.08)' };

/** A small bar chart: one bar per day (no chart library needed) */
const ActivityChart = ({ activity }) => {
  const max = Math.max(1, ...activity.map((item) => item.count));
  return (
    <Box>
      <Box flex style={{ alignItems: 'flex-end', gap: 6, height: 140 }}>
        {activity.map((item) => (
          <Box
            key={item.day}
            title={`${item.day}: ${item.count}`}
            bg="primary100"
            style={{
              flex: 1,
              height: `${Math.max(4, (item.count / max) * 100)}%`,
              borderRadius: '6px 6px 2px 2px',
              opacity: item.count ? 1 : 0.25,
            }}
          />
        ))}
      </Box>
      <Box flex style={{ justifyContent: 'space-between', marginTop: 8 }}>
        <Text color="grey60" fontSize="sm">{activity[0]?.day.slice(5)}</Text>
        <Text color="grey60" fontSize="sm">Today</Text>
      </Box>
    </Box>
  );
};

/** Modern themes: number cards, activity chart, records per module, recent actions */
const ModernHome = ({ data, groups, rootPath, labelOf, session }) => {
  const items = Object.values(groups).flat();
  // The admin log grows with every action, so it isn't counted as data
  const dataItems = items.filter((resource) => !['AdminLog', 'admin_logs'].includes(resource.id));
  const total = dataItems.reduce((sum, resource) => sum + (data.counts?.[resource.id] || 0), 0);
  const largest = Math.max(1, ...items.map((resource) => data.counts?.[resource.id] || 0));
  const actions = (data.activity || []).reduce((sum, item) => sum + item.count, 0);

  return (
    <Box variant="grey">
      <Box mb="xl">
        <H2 mb="sm">Welcome back{session?.title ? `, ${session.title}` : ''}</H2>
        <Text color="grey60">Here is what is happening in {data.title}.</Text>
      </Box>

      {/* Number cards */}
      <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }} mb="xl">
        <Box variant="container" style={card}>
          <Text color="grey60" fontSize="sm">All records</Text>
          <H2 mt="sm" mb="0">{total}</H2>
        </Box>
        <Box variant="container" style={card}>
          <Text color="grey60" fontSize="sm">Actions, last 14 days</Text>
          <H2 mt="sm" mb="0">{actions}</H2>
        </Box>
        {items.map((resource) => {
          const canAdd = resource.resourceActions.some((action) => action.name === 'new');
          return (
            <Box key={resource.id} variant="container" style={card}>
              <Box flex style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <Link to={resource.href} style={{ textDecoration: 'none' }}>
                  <Text color="grey60" fontSize="sm">{labelOf(resource.id)}</Text>
                </Link>
                {canAdd && (
                  <Link to={`${resource.href}/actions/new`} title="Add" style={{ textDecoration: 'none', fontWeight: 600 }}>
                    +
                  </Link>
                )}
              </Box>
              <H2 mt="sm" mb="0">{data.counts?.[resource.id] ?? '…'}</H2>
            </Box>
          );
        })}
      </Box>

      <Box flex style={{ gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Box style={{ flex: '1 1 480px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Box variant="container" style={card}>
            <H4>Activity</H4>
            <Text color="grey60" fontSize="sm" mb="lg">Adds, changes, deletes and imports per day</Text>
            <ActivityChart activity={data.activity || []} />
          </Box>

          <Box variant="container" style={card}>
            <H4 mb="lg">Records per module</H4>
            {items.map((resource) => {
              const count = data.counts?.[resource.id] || 0;
              return (
                <Box key={resource.id} mb="default">
                  <Box flex style={{ justifyContent: 'space-between' }}>
                    <Link to={resource.href}>{labelOf(resource.id)}</Link>
                    <Text color="grey60">{count}</Text>
                  </Box>
                  <Box bg="grey20" style={{ height: 8, borderRadius: 4, marginTop: 4 }}>
                    <Box bg="primary100" style={{ height: 8, borderRadius: 4, width: `${(count / largest) * 100}%` }} />
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>

        <RecentActions recent={data.recent || []} rootPath={rootPath} labelOf={labelOf} />
      </Box>
    </Box>
  );
};

/**
 * Home page of the panel. Its layout follows the theme chosen in the user menu:
 * Modern themes show cards and charts, the others a list of sections like Django's admin.
 */
const Dashboard = () => {
  const resources = useSelector((state) => state.resources);
  const rootPath = useSelector((state) => state.paths.rootPath);
  const theme = useSelector((state) => state.theme);
  const session = useSelector((state) => state.session);
  const { translateLabel } = useTranslation();
  const [data, setData] = useState(EMPTY);

  useEffect(() => {
    api
      .getDashboard()
      .then((response) => setData({ ...EMPTY, ...response.data }))
      .catch(() => setData(EMPTY));
  }, []);

  const groups = groupResources(resources);
  const labelOf = (id) => {
    const resource = resources.find((item) => item.id === id);
    return resource ? translateLabel(resource.name, resource.id) : id;
  };

  const props = { data, groups, rootPath, labelOf, session };
  return theme?.id?.startsWith('modern') ? <ModernHome {...props} /> : <ClassicHome {...props} />;
};

export default Dashboard;
