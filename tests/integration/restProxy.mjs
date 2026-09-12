// Transparent local Supabase /rest/v1 prefix adapter, not a database mock.
// PostgreSQL/PostgREST execute every query and enforce role permissions.
import http from 'node:http';
const server=http.createServer((req,res)=>{
  if(req.headers.origin && req.headers.origin!=='http://127.0.0.1:3218'){res.writeHead(403).end();return;}
  res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:3218');
  res.setHeader('Access-Control-Allow-Headers','authorization,apikey,content-type,x-client-info,prefer,accept-profile,content-profile');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS');
  if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
  if(req.url==='/health'){res.writeHead(200).end('local test proxy');return;}
  if(!req.url?.startsWith('/rest/v1/')){res.writeHead(404).end();return;}
  const upstream=http.request({hostname:'127.0.0.1',port:54834,path:req.url.slice('/rest/v1'.length),method:req.method,headers:{...req.headers,host:'127.0.0.1:54834'}},response=>{
    const headers={...response.headers};delete headers['access-control-allow-origin'];
    res.writeHead(response.statusCode ?? 502,headers);response.pipe(res);
  });
  upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end();});
  req.pipe(upstream);
});
server.listen(54835,'127.0.0.1');
