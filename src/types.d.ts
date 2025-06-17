import '@fastify/jwt';

declare module 'fastify' {
    interface FastifyRequest {
        userEntry: {
            id: string;
            username: string;
        };
    }
}

export { };
