import json


class Response(object):
    @staticmethod
    def set(response, body, code=200):
        response.setHeader('content-type', 'application/json')
        response.setStatus(code)
        response.write(json.dumps(body))

    @staticmethod
    def error(response, msg, code=400):
        Response.set(response, {'error': msg}, code)

    @staticmethod
    def error_fields(response, msg, code=400):
        Response.set(response, {'errors': msg}, code)
